(function () {
  var requested = new URLSearchParams(window.location.search).get('locale')
  var authored = document.documentElement.getAttribute('data-locale') || 'zh-CN'
  var locale = requested === 'zh' ? 'zh-CN' : (requested || authored)
  if (!['zh-CN', 'en', 'ja'].includes(locale)) locale = 'zh-CN'

  var copy = {
    'zh-CN': {
      localeLabel: '中文 / EN / 日本語',
      painKicker: '创作的真实现场',
      painTitle: '真实投入，不该消失。',
      painSub: '需求在聊天里 · 工时在表格里 · 文件在网盘里',
      fragments: ['需求片段', '实际 2.5h', '最终稿_v7'],
      brandKicker: '为什么是 Giverny',
      brandTitle: '可靠的工具，也可以保留艺术。',
      brandBody: '致敬莫奈晚年居住与创作的吉维尼。工作被精确记录，创作仍然保留生长的温度。',
      workflow: '需求 → 进展 → 实际工时 → 文件',
      workflowNote: '每一步都在同一条可追溯链路上',
      acceptance: '验收，是进入结算的边界。',
      acceptanceNote: '进度、工时、附件与验收依据，一次核对',
      settlement: '对账，不再重新证明。',
      settlementNote: '做了什么 · 花了多久 · 交付了什么 · 为什么结算',
      agent: 'Alice 在真实上下文里工作。',
      agentNote: '理解上下文 · 调用工具 · 补充核对 · 结果可验真',
      outroKicker: 'Giverny · 吉维尼',
      outroTitle: '让创作在自己的花园里生长。',
      outroBody: '让每一份投入被看见，让每一次创作留下风景。',
      demo: '产品演示 · 演示空间与虚构数据'
    },
    en: {
      localeLabel: 'EN / 中文 / 日本語',
      painKicker: 'The reality of creative work',
      painTitle: "Real work shouldn't disappear.",
      painSub: 'Briefs in chats · Hours in sheets · Files in drives',
      fragments: ['A scattered brief', 'Actual 2.5h', 'final_v7'],
      brandKicker: 'Why Giverny',
      brandTitle: 'Reliable tools can still feel human.',
      brandBody: "Inspired by Monet's garden, Giverny keeps work precise without taking the life out of creation.",
      workflow: 'Brief → Progress → Actual time → Files',
      workflowNote: 'Every contribution stays on one traceable timeline',
      acceptance: 'Acceptance turns effort into accountable results.',
      acceptanceNote: 'Progress, time, files, and approval evidence—checked once',
      settlement: 'No more reconstructing the month.',
      settlementNote: 'What was done · How long it took · What was delivered · Why it is billed',
      agent: 'Alice works inside the real context.',
      agentNote: 'Context-aware · Tool-using · Double-checked · Verifiable',
      outroKicker: 'Giverny',
      outroTitle: 'Let creation grow in its own garden.',
      outroBody: 'Make every contribution visible, and let every creation leave a landscape behind.',
      demo: 'Product demo · fictional demo workspace data'
    },
    ja: {
      localeLabel: '日本語 / EN / 中文',
      painKicker: 'クリエイティブな仕事の現実',
      painTitle: '本当の貢献を、消さない。',
      painSub: '依頼はチャット · 時間は表計算 · ファイルはドライブ',
      fragments: ['依頼の断片', '実績 2.5h', '最終版_v7'],
      brandKicker: 'Why Giverny',
      brandTitle: '信頼できる道具に、人の温度を。',
      brandBody: 'モネの庭に着想を得て、仕事の正確さと創造の喜びを両立します。',
      workflow: '依頼 → 進捗 → 実績時間 → ファイル',
      workflowNote: 'すべての貢献を、一本の追跡可能な流れに',
      acceptance: '検収が、精算への境界になる。',
      acceptanceNote: '進捗、時間、添付、承認根拠を確認',
      settlement: '月末の再構成は、もう必要ない。',
      settlementNote: '何をしたか · どれだけか · 何を納品したか · なぜ請求するか',
      agent: 'Alice は実際の文脈で働く。',
      agentNote: '文脈理解 · ツール実行 · 追加検証 · 検証可能',
      outroKicker: 'Giverny',
      outroTitle: '創造を、自分の庭で育てよう。',
      outroBody: 'すべての貢献を可視化し、すべての創造に風景を残す。',
      demo: '製品デモ · 架空のデモデータ'
    }
  }

  window.GivernyPromoLocale = {
    locale: locale,
    copy: copy[locale],
    apply: function () {
      document.documentElement.lang = locale
      document.querySelectorAll('[data-i18n]').forEach(function (el) {
        var value = copy[locale][el.getAttribute('data-i18n')]
        if (typeof value === 'string') el.textContent = value
      })
      document.querySelectorAll('[data-i18n-list]').forEach(function (el) {
        var value = copy[locale][el.getAttribute('data-i18n-list')]
        if (Array.isArray(value)) el.querySelectorAll('[data-item]').forEach(function (item, i) { item.textContent = value[i] || '' })
      })
    }
  }
})()
