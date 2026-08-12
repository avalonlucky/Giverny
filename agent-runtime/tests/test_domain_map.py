"""领域地图：解析、命中、注入与降级。

线上原始故障：用户问「结算回单」——站内七大导航之一——对象判断阶段把它当成一个
不认识的具名对象名，拿任务/刊物解析器去模糊搜任务标题，绕一大圈才碰到正确的工具。
这些用例锁住的正是"它现在知道站内有哪些业务领域"这件事。
"""

import unittest

from app.domain import DomainMap, render_domain_hits
from app.runtime import _apply_domain_routing
from app.schemas import RoutingDecision


MANIFEST = [
    {
        "domain": "结算",
        "summary": "按日期范围冻结的结算回单快照，附 Excel 与分享链接。",
        "aliases": ["结算", "结算回单", "回单", "对账单", "导出记录"],
        "specialist": "workspace_analyst",
        "unreadable": "",
        "objects": [{"name": "结算回单", "fields": ["导出时间（exportedAt）", "结算金额（amount）", "任务数（taskCount）"]}],
        "operations": [
            {"operation": "query_settlement_exports", "title": "查询结算导出记录", "description": "按日期范围查询结算导出。"},
            {"operation": "reconcile_settlement_export", "title": "核对结算回单", "description": "确定性复算结算快照。"},
        ],
    },
    {
        "domain": "洞察",
        "summary": "按周期做异常诊断。",
        "aliases": ["洞察", "诊断", "异常"],
        "specialist": "workspace_analyst",
        "unreadable": "洞察页面自己生成的诊断记录没有对应的读取工具。",
        "objects": [],
        "operations": [],
    },
    {
        "domain": "设置",
        "summary": "Giverny 自身的配置。",
        "aliases": ["设置", "模型路由", "快捷键"],
        "specialist": "product_support",
        "unreadable": "",
        "objects": [],
        "operations": [{"operation": "search_product_help", "title": "查询产品使用说明", "description": "查询站内使用说明。"}],
    },
]


def build_map() -> DomainMap:
    return DomainMap.from_spec({"paths": {}, "x-giverny-domains": MANIFEST})


def build_routing(**overrides) -> RoutingDecision:
    payload = {
        "intent_summary": "用户在问结算回单",
        "domain": "",
        "allowed_specialists": [],
        "requires_evidence": True,
        "rationale": "需要工作区证据",
    }
    payload.update(overrides)
    return RoutingDecision.model_validate(payload)


class DomainParsingTest(unittest.TestCase):
    def test_parses_every_domain_from_the_openapi_extension(self):
        domain_map = build_map()
        self.assertEqual(domain_map.names(), ("结算", "洞察", "设置"))
        settlement = domain_map.get("结算")
        self.assertEqual(settlement.specialist, "workspace_analyst")
        self.assertEqual(settlement.operation_names(), ("query_settlement_exports", "reconcile_settlement_export"))

    def test_domain_name_itself_is_always_an_alias(self):
        # 地图作者不必把导航名重复写进 aliases，写漏了也不能因此漏命中。
        raw = [{**MANIFEST[0], "aliases": ["回单"]}]
        domain_map = DomainMap.from_spec({"x-giverny-domains": raw})
        self.assertEqual(domain_map.match("结算这个月怎么算的"), ("结算",))

    def test_missing_extension_degrades_instead_of_crashing(self):
        # 旧版 Worker 不带这个扩展。整轮编排必须照常跑完，只是退回没有地图的行为。
        empty = DomainMap.from_spec({"paths": {}})
        self.assertFalse(empty)
        self.assertEqual(empty.names(), ())
        self.assertEqual(empty.match("结算回单"), ())
        self.assertEqual(empty.render_catalog(), "")
        self.assertEqual(empty.render_playbook("结算"), "")

    def test_malformed_entries_are_skipped_not_fatal(self):
        domain_map = DomainMap.from_spec({"x-giverny-domains": ["", None, {"domain": ""}, MANIFEST[0]]})
        self.assertEqual(domain_map.names(), ("结算",))


class DomainMatchTest(unittest.TestCase):
    def test_settlement_receipt_hits_the_settlement_domain(self):
        # 这就是线上那句问题。命中之后它不再是"陌生对象名"。
        self.assertEqual(build_map().match("帮我看看最近一次导出结算回单是什么时候"), ("结算",))

    def test_longer_alias_ranks_first_when_several_domains_hit(self):
        hits = build_map().match("结算回单里的异常要怎么看")
        self.assertEqual(hits[0], "结算")
        self.assertIn("洞察", hits)

    def test_unrelated_question_matches_nothing(self):
        self.assertEqual(build_map().match("明天北京天气怎么样"), ())


class DomainRoutingTest(unittest.TestCase):
    def test_model_domain_opens_the_matching_specialist(self):
        routing = _apply_domain_routing(build_routing(domain="设置"), build_map(), ())
        self.assertEqual(routing.domain, "设置")
        self.assertIn("product_support", routing.allowed_specialists)

    def test_single_literal_hit_backfills_a_missing_domain(self):
        # 模型漏了定域，但用户把导航名说出口了——这一类不能靠模型运气。
        routing = _apply_domain_routing(build_routing(), build_map(), ("结算",))
        self.assertEqual(routing.domain, "结算")
        self.assertIn("workspace_analyst", routing.allowed_specialists)

    def test_multiple_hits_do_not_override_model_judgement(self):
        # 命中多个说明问题本身跨域，字面匹配没有资格替语义判断做决定。
        routing = _apply_domain_routing(build_routing(), build_map(), ("结算", "洞察"))
        self.assertEqual(routing.domain, "")
        self.assertEqual(routing.allowed_specialists, [])

    def test_hallucinated_domain_is_discarded(self):
        routing = _apply_domain_routing(build_routing(domain="财务中心"), build_map(), ())
        self.assertEqual(routing.domain, "")
        self.assertEqual(routing.allowed_specialists, [])

    def test_hallucinated_domain_still_falls_back_to_a_literal_hit(self):
        routing = _apply_domain_routing(build_routing(domain="财务中心"), build_map(), ("结算",))
        self.assertEqual(routing.domain, "结算")

    def test_existing_specialists_are_kept(self):
        routing = _apply_domain_routing(
            build_routing(domain="结算", allowed_specialists=["web_researcher"]), build_map(), ()
        )
        self.assertEqual(routing.allowed_specialists, ["web_researcher", "workspace_analyst"])

    def test_empty_map_leaves_routing_untouched(self):
        routing = _apply_domain_routing(build_routing(domain="结算"), DomainMap(), ("结算",))
        self.assertEqual(routing.domain, "结算")
        self.assertEqual(routing.allowed_specialists, [])


class DomainRenderTest(unittest.TestCase):
    def test_catalog_lists_every_domain_with_its_aliases(self):
        catalog = build_map().render_catalog()
        for name in ("结算", "洞察", "设置"):
            self.assertIn(name, catalog)
        self.assertIn("结算回单", catalog)
        self.assertIn("洞察页面自己生成的诊断记录没有对应的读取工具。", catalog)

    def test_playbook_names_the_fields_and_the_tools(self):
        playbook = build_map().render_playbook("结算")
        self.assertIn("导出时间（exportedAt）", playbook)
        self.assertIn("query_settlement_exports", playbook)
        self.assertIn("reconcile_settlement_export", playbook)

    def test_playbook_of_an_unreadable_domain_states_the_limit(self):
        # 知道"读不到"和知道"读得到"同等重要：否则它会一直换关键词搜，或者干脆编一个。
        playbook = build_map().render_playbook("洞察")
        self.assertIn("读取边界", playbook)
        self.assertIn("没有对应的读取工具", playbook)

    def test_unknown_domain_renders_nothing(self):
        self.assertEqual(build_map().render_playbook("不存在的域"), "")

    def test_domain_hits_render_only_when_something_hit(self):
        self.assertEqual(render_domain_hits(()), "")
        self.assertEqual(render_domain_hits(("结算", "洞察")), "<domain_hits>结算、洞察</domain_hits>")


if __name__ == "__main__":
    unittest.main()
