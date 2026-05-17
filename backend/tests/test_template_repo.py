"""
Tests for template_repo CRUD and version-bump behaviour.

Covers: create, list, get, update (with and without column changes), delete.
Uses a real database (see conftest.py).
"""

import pytest

from app.db.models import SchemaTemplate
from app.domain.template_schemas import ProposedColumnSchema, SchemaTemplateCreate, SchemaTemplateUpdate
from app.repositories import template_repo


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _col(name: str, type_: str = "text") -> ProposedColumnSchema:
    return ProposedColumnSchema(name=name, description=f"Description for {name}", type=type_, required=True)


def _create_body(name: str = "My Template", *, n_cols: int = 3) -> SchemaTemplateCreate:
    return SchemaTemplateCreate(
        name=name,
        description="A test template",
        visibility="private",
        columns=[_col(f"col_{i}") for i in range(n_cols)],
    )


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

class TestCreateTemplate:
    def test_creates_row_with_version_1(self, db):
        body = _create_body()
        tmpl = template_repo.create_template(db, body)

        assert tmpl.id is not None
        assert tmpl.name == "My Template"
        assert tmpl.version == 1
        assert tmpl.visibility == "private"
        assert len(tmpl.columns) == 3

    def test_created_by_defaults_to_recruiter(self, db):
        tmpl = template_repo.create_template(db, _create_body())
        assert tmpl.created_by == "recruiter"

    def test_created_by_overridable(self, db):
        tmpl = template_repo.create_template(db, _create_body(), created_by="system")
        assert tmpl.created_by == "system"

    def test_columns_stored_as_dicts(self, db):
        tmpl = template_repo.create_template(db, _create_body(n_cols=2))
        assert isinstance(tmpl.columns, list)
        assert tmpl.columns[0]["name"] == "col_0"
        assert tmpl.columns[0]["type"] == "text"

    def test_description_stored(self, db):
        tmpl = template_repo.create_template(db, _create_body())
        assert tmpl.description == "A test template"

    def test_null_description_allowed(self, db):
        body = SchemaTemplateCreate(
            name="Minimal",
            description=None,
            visibility="workspace",
            columns=[_col("x")],
        )
        tmpl = template_repo.create_template(db, body)
        assert tmpl.description is None


# ---------------------------------------------------------------------------
# Get / list
# ---------------------------------------------------------------------------

class TestGetListTemplate:
    def test_get_returns_correct_template(self, db):
        tmpl = template_repo.create_template(db, _create_body("Alpha"))
        fetched = template_repo.get_template(db, tmpl.id)

        assert fetched is not None
        assert fetched.id == tmpl.id
        assert fetched.name == "Alpha"

    def test_get_returns_none_for_unknown_id(self, db):
        import uuid
        assert template_repo.get_template(db, uuid.uuid4()) is None

    def test_list_returns_all_templates(self, db):
        template_repo.create_template(db, _create_body("First"))
        template_repo.create_template(db, _create_body("Second"))

        results = template_repo.list_templates(db)
        names = [t.name for t in results]
        assert "First" in names
        assert "Second" in names

    def test_list_ordered_by_updated_at_desc(self, db):
        t1 = template_repo.create_template(db, _create_body("Old"))
        t2 = template_repo.create_template(db, _create_body("Newer"))

        results = list(template_repo.list_templates(db))
        ids = [t.id for t in results]
        # Newer template should appear first
        assert ids.index(t2.id) < ids.index(t1.id)


# ---------------------------------------------------------------------------
# Update — metadata only (no column change → version MUST NOT bump)
# ---------------------------------------------------------------------------

class TestUpdateTemplateMeta:
    def test_name_update_does_not_bump_version(self, db):
        tmpl = template_repo.create_template(db, _create_body())
        assert tmpl.version == 1

        updated = template_repo.update_template(db, tmpl, SchemaTemplateUpdate(name="Renamed"))

        assert updated.name == "Renamed"
        assert updated.version == 1

    def test_description_update_does_not_bump_version(self, db):
        tmpl = template_repo.create_template(db, _create_body())
        updated = template_repo.update_template(
            db, tmpl, SchemaTemplateUpdate(description="New description")
        )
        assert updated.version == 1

    def test_visibility_update_does_not_bump_version(self, db):
        tmpl = template_repo.create_template(db, _create_body())
        updated = template_repo.update_template(
            db, tmpl, SchemaTemplateUpdate(visibility="workspace")
        )
        assert updated.visibility == "workspace"
        assert updated.version == 1


# ---------------------------------------------------------------------------
# Update — column change → version MUST bump
# ---------------------------------------------------------------------------

class TestUpdateTemplateColumns:
    def test_column_change_bumps_version(self, db):
        tmpl = template_repo.create_template(db, _create_body(n_cols=2))
        assert tmpl.version == 1

        new_cols = [_col("alpha"), _col("beta"), _col("gamma")]
        updated = template_repo.update_template(
            db, tmpl, SchemaTemplateUpdate(columns=new_cols)
        )

        assert updated.version == 2
        assert len(updated.columns) == 3

    def test_repeated_column_updates_increment_version_each_time(self, db):
        tmpl = template_repo.create_template(db, _create_body(n_cols=1))

        template_repo.update_template(db, tmpl, SchemaTemplateUpdate(columns=[_col("v2")]))
        assert tmpl.version == 2

        template_repo.update_template(db, tmpl, SchemaTemplateUpdate(columns=[_col("v3")]))
        assert tmpl.version == 3

    def test_combined_name_and_column_update_bumps_version(self, db):
        tmpl = template_repo.create_template(db, _create_body(n_cols=2))
        updated = template_repo.update_template(
            db, tmpl,
            SchemaTemplateUpdate(name="New name", columns=[_col("only_col")]),
        )

        assert updated.name == "New name"
        assert updated.version == 2


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

class TestDeleteTemplate:
    def test_delete_removes_row(self, db):
        tmpl = template_repo.create_template(db, _create_body())
        tid = tmpl.id

        template_repo.delete_template(db, tmpl)

        assert template_repo.get_template(db, tid) is None

    def test_delete_does_not_affect_other_templates(self, db):
        t1 = template_repo.create_template(db, _create_body("Keep"))
        t2 = template_repo.create_template(db, _create_body("Delete me"))

        template_repo.delete_template(db, t2)

        assert template_repo.get_template(db, t1.id) is not None
        assert template_repo.get_template(db, t2.id) is None
