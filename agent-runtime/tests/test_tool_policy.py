import unittest

from app.tooling import ToolFactory, select_operation_ids


SPEC = {
    "paths": {
        "/read": {
            "get": {
                "operationId": "read_task",
                "tags": ["tasks"],
                "x-giverny-policy": {"roles": ["admin", "viewer"], "confirmation": "none"},
            }
        },
        "/preview": {
            "post": {
                "operationId": "update_task_preview",
                "tags": ["write"],
                "x-giverny-policy": {"roles": ["admin"], "confirmation": "preview"},
            }
        },
        "/execute": {
            "post": {
                "operationId": "update_task",
                "tags": ["write"],
                "x-giverny-policy": {"roles": ["admin"], "confirmation": "signed-execute"},
            }
        },
    }
}


class ToolPolicyTest(unittest.TestCase):
    def test_read_specialist_cannot_see_write_tools(self):
        self.assertEqual(select_operation_ids(SPEC, role="viewer", groups={"tasks"}, include_preview=False), ["read_task"])

    def test_transaction_specialist_only_sees_preview(self):
        self.assertEqual(select_operation_ids(SPEC, role="admin", groups={"write"}, include_preview=True), ["update_task_preview"])

    def test_signed_execute_never_reaches_model(self):
        selected = select_operation_ids(SPEC, role="admin", groups={"write"}, include_preview=True)
        self.assertNotIn("update_task", selected)

    def test_preview_maps_to_deterministic_execute_endpoint(self):
        factory = ToolFactory(spec=SPEC, token="token", timeout_seconds=5)
        action = factory.pending_action("update_task_preview", {
            "confirmationToken": "secret", "draft": {"title": "A"}, "warnings": [],
        })
        self.assertEqual(action["action"], "update_task")
        self.assertEqual(action["executeEndpoint"], "execute")

    def test_header_provider_replaces_interactive_openapi_auth(self):
        secured = {
            **SPEC,
            "components": {"securitySchemes": {"BearerAuth": {"type": "http", "scheme": "bearer"}}},
        }
        secured["paths"]["/read"]["get"]["security"] = [{"BearerAuth": []}]
        factory = ToolFactory(spec=secured, token="token", timeout_seconds=5)
        self.assertNotIn("securitySchemes", factory.runtime_spec["components"])
        self.assertNotIn("security", factory.runtime_spec["paths"]["/read"]["get"])

    def test_workspace_search_is_not_owned_by_product_support(self):
        spec = {
            "paths": {"/search": {"post": {
                "operationId": "search_workspace", "tags": ["product"],
                "x-giverny-policy": {"roles": ["admin"], "confirmation": "none"},
            }}}
        }
        factory = ToolFactory(spec=spec, token="token", timeout_seconds=5)
        self.assertIn("search_workspace", select_operation_ids(factory.routing_spec, role="admin", groups={"memory"}, include_preview=False))
        self.assertNotIn("search_workspace", select_operation_ids(factory.routing_spec, role="admin", groups={"product"}, include_preview=False))


if __name__ == "__main__":
    unittest.main()
