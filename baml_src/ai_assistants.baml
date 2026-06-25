generator typescript {
  version "0.222.0"
  output_type "typescript"
  output_dir "../src/baml_client"
  module_format "esm"
}

generator runtime_typescript {
  version "0.222.0"
  output_type "typescript"
  output_dir "../ai-runtime/src/baml_client"
  module_format "esm"
}

client<llm> DeepSeekDefault {
  provider "openai-generic"
  options {
    base_url "https://api.deepseek.com"
    api_key env.DEEPSEEK_API_KEY
    model "deepseek-chat"
  }
}

class TaskAssistantOutput {
  optimizedRequirement string @description("优化后的中文任务需求。必须严格使用三段：1、设计背景；2、设计要求；3、输出文件。")
  suggestedParentType string @description("推荐的大类名称，优先从已有设计类型大类中选择。")
  suggestedChildType string @description("推荐的子类名称，优先从对应大类 items 中选择。")
  reason string @description("一句话说明为什么推荐该类型。")
}

class TextAssistantOutput {
  optimizedText string @description("可直接写入进展记录或验收备注的中文文本，必须用「1、」「2、」「3、」中文序号分点排列，每点一行。")
  summary string @description("一句话说明本次优化依据。")
}

enum HourEstimateConfidence {
  Low @alias("低")
  Medium @alias("中")
  High @alias("高")
}

class HourEstimateOutput {
  suggestedHours float @description("建议预估工时，单位小时。")
  confidence HourEstimateConfidence @description("置信度。样本少于 3 条时必须为低。")
  basis string[] @description("2-5 条中文依据。")
  historicalSummary string @description("一句中文总结历史同类任务表现。")
}

function SuggestTaskAssistant(payload_json: string) -> TaskAssistantOutput {
  client DeepSeekDefault
  prompt #"
    你是一个平面设计兼职任务助理。请把用户的原始需求改写成专业、可执行、可直接写入任务单的中文描述，并从已有设计类型中选择最贴近的大类和子类。

    改写目标：
    - 不是只排版，而是把口语化表达改成专业任务单语言。
    - 把模糊描述整理成可执行要求。
    - 把散乱信息归并到对应模块。

    允许：修正语病；归并重复信息；把用户已经表达的需求整理成明确动作；基于原文把“用途/场景/必须包含内容/输出清单”补全到对应模块。
    禁止：凭空编造用户没提过的交付物、尺寸、品牌规范、交付承诺或验收标准；丢失用户提到的背景、约束、文件名、版本号、数量；写客套话或解释你做了什么。

    输出必须严格使用以下三段固定模板，段标题一字不改，用换行分隔：
    1、设计背景：[项目用途/场景/对接背景]
    2、设计要求：[风格/调性/必须包含的元素/区域]
    3、输出文件：[交付物清单]

    方括号只是提示含义，最终不要保留方括号。用户没有提供的信息写“未明确，可在对接时确认”，不要自己编。

    输入 JSON：
    {{ payload_json }}

    {{ ctx.output_format }}
  "#
}

function OptimizeTaskText(payload_json: string) -> TextAssistantOutput {
  client DeepSeekDefault
  prompt #"
    你是一个设计兼职任务管理助手。请基于任务信息、进展记录、文件/交付件名称和用户已写文本，优化成可直接写入系统的中文记录。

    要求：
    - 保留事实。
    - 不要编造文件内容、未出现的交付物、验收结果、客户反馈或承诺。
    - 如果只能从文件名判断，请使用“已上传/已补充”这类稳妥表达。
    - 语言要专业、简洁、像内部工作记录。
    - 【结构化】必须把内容拆成分点，用「1、」「2、」「3、」中文序号逐条排列，每点单独一行、一行说清一件事，不要写成一大段。只有一件事时也用「1、」开头。

    progress 模式：分点列出当前完成到哪一步、做了哪些具体改动、已上传哪些过程附件、下一步（仅在有明确事实时写）。不要写成正式验收结论。
    acceptance 模式：分点列出交付/补传了哪些文件、关键进展、结算/补录说明。不要改变验收状态，不要凭空说客户已确认。

    只返回优化后的文本（分点序号格式）和一句简短摘要。

    输入 JSON：
    {{ payload_json }}

    {{ ctx.output_format }}
  "#
}

function SuggestHourEstimate(payload_json: string) -> HourEstimateOutput {
  client DeepSeekDefault
  prompt #"
    你是一个设计兼职任务的工时分析助理。请只基于系统提供的历史任务样本、实际工时、交付周期、验收备注和当前任务需求，给出新任务的预估工时建议。

    要求：
    - 不要编造不存在的历史数据。
    - 样本少于 3 条时必须降低置信度。
    - 需要结合验收备注判断返工、补传、尺寸/交付物复杂度。
    - 建议工时用小时数，优先参考历史实际工时的平均数和中位数，可以根据当前任务复杂度微调。
    - 依据要短、具体、可解释。

    输入 JSON：
    {{ payload_json }}

    {{ ctx.output_format }}
  "#
}
