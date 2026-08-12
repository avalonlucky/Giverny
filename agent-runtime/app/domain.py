from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


# 一个别名要短到用户真会这么说，又长到不会误伤。"税"只有两画，出现在
# "税前收入"里是对的，出现在"税务局"里也命中——但那不是本站会问的问题。
# 真正需要拦的是单字：单个字符做别名几乎必然误命中，直接丢掉。
_MIN_ALIAS_LENGTH = 2


@dataclass(frozen=True)
class DomainObject:
    name: str
    fields: tuple[str, ...]


@dataclass(frozen=True)
class DomainOperation:
    operation: str
    title: str
    description: str


@dataclass(frozen=True)
class Domain:
    name: str
    summary: str
    aliases: tuple[str, ...]
    specialist: str
    unreadable: str
    objects: tuple[DomainObject, ...]
    operations: tuple[DomainOperation, ...]

    def operation_names(self) -> tuple[str, ...]:
        return tuple(item.operation for item in self.operations)


@dataclass(frozen=True)
class DomainMap:
    """站内业务领域地图，来自 OpenAPI 的 x-giverny-domains 扩展。

    它回答的是"这个网站里有什么"，属于要理解的知识，不是要检索的数据。
    没有它时，对象判断阶段手里只有一把锤子——具名对象解析——于是"结算回单"这种
    一等业务概念也被当成陌生对象名，拿去模糊搜任务标题。
    """

    domains: tuple[Domain, ...] = ()

    @classmethod
    def from_spec(cls, spec: dict[str, Any]) -> "DomainMap":
        raw = spec.get("x-giverny-domains")
        if not isinstance(raw, list):
            # 旧版 Worker 不带这个扩展。整轮编排必须照常跑完，只是退回没有地图的行为。
            return cls()
        domains: list[Domain] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            name = str(item.get("domain") or "").strip()
            if not name:
                continue
            aliases = {name, *(str(value).strip() for value in item.get("aliases", []) if str(value).strip())}
            domains.append(Domain(
                name=name,
                summary=str(item.get("summary") or "").strip(),
                aliases=tuple(sorted(aliases, key=len, reverse=True)),
                specialist=str(item.get("specialist") or "").strip(),
                unreadable=str(item.get("unreadable") or "").strip(),
                objects=tuple(
                    DomainObject(
                        name=str(entry.get("name") or "").strip(),
                        fields=tuple(str(field).strip() for field in entry.get("fields", []) if str(field).strip()),
                    )
                    for entry in item.get("objects", [])
                    if isinstance(entry, dict) and str(entry.get("name") or "").strip()
                ),
                operations=tuple(
                    DomainOperation(
                        operation=str(entry.get("operation") or "").strip(),
                        title=str(entry.get("title") or "").strip(),
                        description=str(entry.get("description") or "").strip(),
                    )
                    for entry in item.get("operations", [])
                    if isinstance(entry, dict) and str(entry.get("operation") or "").strip()
                ),
            ))
        return cls(domains=tuple(domains))

    def __bool__(self) -> bool:
        return bool(self.domains)

    def names(self) -> tuple[str, ...]:
        return tuple(domain.name for domain in self.domains)

    def get(self, name: str) -> Domain | None:
        target = str(name or "").strip()
        if not target:
            return None
        return next((domain for domain in self.domains if domain.name == target), None)

    def match(self, text: str) -> tuple[str, ...]:
        """问题里直接出现的领域，按最长别名命中排序。

        这是确定性的一层，不替代模型判断：命中结果作为线索交给对象判断阶段，
        模型仍然可以基于语义选别的域。它保证的是"用户把导航名说出口了"这种
        最直白的情况不会被漏掉。
        """
        haystack = str(text or "")
        if not haystack:
            return ()
        scored: list[tuple[int, str]] = []
        for domain in self.domains:
            best = max(
                (len(alias) for alias in domain.aliases if len(alias) >= _MIN_ALIAS_LENGTH and alias in haystack),
                default=0,
            )
            if best:
                scored.append((best, domain.name))
        scored.sort(key=lambda item: (-item[0], item[1]))
        return tuple(name for _, name in scored)

    def render_catalog(self) -> str:
        """对象判断阶段看到的全量地图。每域一行，尽量短——它是每轮都付的固定成本。"""
        if not self.domains:
            return ""
        lines = ["<domain_map>", "站内业务领域（这些是网站的一等概念，不是需要检索的对象名）："]
        for domain in self.domains:
            aliases = "、".join(domain.aliases[:12])
            lines.append(f"- **{domain.name}**：{domain.summary} 用户可能说：{aliases}。归口：{domain.specialist}。")
            if domain.unreadable:
                lines.append(f"  注意：{domain.unreadable}")
        lines.append("</domain_map>")
        return "\n".join(lines)

    def render_playbook(self, name: str) -> str:
        """定域之后交给协调阶段的单域展开：字段叫什么、用哪个工具。"""
        domain = self.get(name)
        if not domain:
            return ""
        lines = [f"<domain_playbook domain=\"{domain.name}\">", domain.summary]
        for entry in domain.objects:
            fields = "、".join(entry.fields)
            lines.append(f"「{entry.name}」的字段：{fields}")
        if domain.operations:
            lines.append("该领域的问题优先用这些工具，不要用任务标题模糊搜索代替：")
            for operation in domain.operations:
                lines.append(f"- {operation.operation}（{operation.title}）：{operation.description}")
        if domain.unreadable:
            lines.append(f"读取边界：{domain.unreadable}")
        lines.append("</domain_playbook>")
        return "\n".join(lines)


def render_domain_hits(hits: tuple[str, ...]) -> str:
    if not hits:
        return ""
    return f"<domain_hits>{'、'.join(hits)}</domain_hits>"


# 模型会在推理里复述领域地图的标签。出口消毒已经覆盖注册表里的工具名，
# 这里兜住地图特有的标签，避免 `<domain_playbook domain="结算">` 原样漏进用户界面。
_DOMAIN_TAG_PATTERN = re.compile(r"<(/?)domain_(map|playbook|hits)(?:\s+domain=\"([^\"]*)\")?[^>]*>")


def scrub_domain_tags(text: str) -> str:
    """把领域标签换成人话，而不是整段删掉。

    直接删会连 `domain="结算"` 里的领域名一起带走，句子就成了"按 的说明"。
    用户读的正是这段推理，语义不能因为消毒而丢失。
    """

    def replace(match: re.Match[str]) -> str:
        if match.group(1):
            return ""
        label = {"map": "领域地图", "playbook": "领域说明", "hits": "命中领域"}[match.group(2)]
        name = match.group(3)
        return f"「{name}」的{label}" if name else label

    return _DOMAIN_TAG_PATTERN.sub(replace, text)
