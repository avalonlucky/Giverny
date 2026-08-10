import unittest

from app.schemas import Principal
from app.security import canonical_scope, runtime_key_matches, sign_scope


class SecurityTest(unittest.TestCase):
    def setUp(self):
        self.principal = Principal(
            workspaceId="workspace-a",
            principalId="user-a",
            role="admin",
            runId="run-a",
        )

    def test_scope_signature_matches_worker_contract(self):
        timestamp = 1786348800000
        self.assertEqual(
            canonical_scope(self.principal, timestamp),
            "workspace-a\nuser-a\nadmin\nrun-a\n1786348800000",
        )
        self.assertEqual(sign_scope("secret", self.principal, timestamp), sign_scope("secret", self.principal, timestamp))

    def test_runtime_key_uses_strict_match(self):
        self.assertTrue(runtime_key_matches("secret", "secret"))
        self.assertFalse(runtime_key_matches("secret", "Secret"))
        self.assertFalse(runtime_key_matches("", ""))


if __name__ == "__main__":
    unittest.main()
