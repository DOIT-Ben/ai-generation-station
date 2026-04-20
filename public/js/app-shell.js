(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AppShell = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const AUTH = {
    username: 'studio',
    password: 'AIGS2026!'
  };

  const MAX_HISTORY_ITEMS = 12;
  const STORAGE_PREFIX = 'aigs.v2';

  const FEATURE_META = {
    chat: { title: 'AI 对话', historyTitle: '最近会话' },
    lyrics: { title: '歌词创作', historyTitle: '歌词历史' },
    cover: { title: '图片生成', historyTitle: '图片历史' },
    speech: { title: '语音合成', historyTitle: '语音历史' },
    music: { title: '音乐生成', historyTitle: '音乐历史' },
    covervoice: { title: '歌声翻唱', historyTitle: '翻唱历史' }
  };

  const TEMPLATE_LIBRARY = {
    chat: [
      {
        category: '内容创作',
        items: [
          { label: '短视频脚本', description: '生成抖音口播脚本', message: '请帮我写一个 60 秒短视频口播脚本，主题是“AI 如何帮独立创业者省时间”，要求开头 3 秒有钩子，结尾带 CTA。' },
          { label: '公众号选题', description: '输出 10 个爆款选题', message: '请给我 10 个适合 AI 工具类公众号的选题，每个选题都包含目标读者、标题风格和切入角度。' },
          { label: '产品卖点', description: '拆出卖点文案', message: '我有一个 AI 内容生成网站，请帮我提炼 5 条核心卖点，每条卖点都写成首页可直接使用的短句。' },
          { label: '直播提纲', description: '生成直播结构', message: '请帮我做一个 45 分钟的 AI 工具分享直播提纲，分成开场、演示、互动、成交 4 个环节。' }
        ]
      },
      {
        category: '工作效率',
        items: [
          { label: '周报助手', description: '整理成专业周报', message: '我这周做了产品迭代、用户访谈和回归测试，请帮我整理成一份给老板看的周报，要求有成果、问题和下周计划。' },
          { label: '会议纪要', description: '提炼行动项', message: '请根据一次产品评审会，生成会议纪要模板，重点包含结论、待办、负责人和截止时间。' },
          { label: '需求拆解', description: '拆成功能任务', message: '请把“给 AI 生成网站增加登录、模板和历史记录”拆成开发任务清单，按前端、后端、测试分类。' },
          { label: '风险审查', description: '找出项目风险', message: '请从安全、可维护性、用户体验和测试覆盖这 4 个维度，审查一个 AI 网站上线前的主要风险。' }
        ]
      },
      {
        category: '学习研究',
        items: [
          { label: '概念讲解', description: '通俗讲清技术概念', message: '请用非技术人员能听懂的方式解释什么是向量数据库，并举 3 个实际业务例子。' },
          { label: '英文翻译润色', description: '商务英文优化', message: '请把下面这段中文产品介绍翻译成自然的商务英文，并保留营销感。' },
          { label: '课程计划', description: '生成学习路径', message: '请为一个零基础的人设计 14 天的 AI 应用学习计划，每天 30 分钟，目标是学会用 AI 提升工作效率。' },
          { label: '资料总结', description: '输出结构化摘要', message: '我会给你一段长文，请帮我提炼出 5 个核心观点、3 个可执行建议和 2 个值得追问的问题。' }
        ]
      },
      {
        category: '商业咨询',
        items: [
          { label: '竞品分析', description: '对比 3 个产品', message: '请以“目标用户、核心功能、收费方式、差异化优势”四个维度，对比 3 个 AI 内容生成产品。' },
          { label: '定价策略', description: '给 SaaS 定价', message: '一个 AI 内容生成网站有对话、歌词、图片、音乐和翻唱功能，请给出阶梯定价建议，并说明每档适合谁。' },
          { label: '冷启动方案', description: '获取第一批用户', message: '请给我一份 AI 工具网站冷启动方案，要求包含渠道、内容策略、转化动作和衡量指标。' },
          { label: '用户画像', description: '细分目标人群', message: '请为 AI 内容生成网站拆出 4 类核心用户画像，并写出他们最在意的使用场景和付费动机。' }
        ]
      }
    ],
    lyrics: [
      {
        category: '情绪抒情',
        items: [
          { label: '深夜疗愈', description: '城市夜景与希望', values: { prompt: '一首关于深夜城市与未来希望的中文流行歌词', style: 'pop', structure: '主歌1-副歌-主歌2-副歌-桥段-副歌' } },
          { label: '分手释怀', description: '克制而温柔', values: { prompt: '一首关于成熟分手后的释然与祝福的抒情歌词', style: 'ballad', structure: '主歌-副歌-主歌-副歌' } },
          { label: '思念远方', description: '给异地恋人的歌', values: { prompt: '写一首献给异地恋人的歌词，主题是距离让思念更真实', style: 'pop', structure: '标准结构' } },
          { label: '雨夜独白', description: '带点电影感', values: { prompt: '用电影感笔触写一首雨夜独白歌词，情绪是孤独但不绝望', style: 'folk', structure: '完整结构' } }
        ]
      },
      {
        category: '成长励志',
        items: [
          { label: '毕业远行', description: '毕业季合唱', values: { prompt: '写一首适合毕业季合唱的励志歌词，主题是各自奔赴远方', style: 'pop', structure: '标准结构' } },
          { label: '追梦者', description: '热血但不过度喊口号', values: { prompt: '一首关于年轻人追梦的歌词，要热血但避免空洞口号', style: 'rock', structure: '完整结构' } },
          { label: '创业心声', description: '给独立创业者', values: { prompt: '写一首给独立创业者的歌，主题是焦虑、坚持和最终突破', style: 'rap', structure: '主歌-副歌-主歌-副歌' } },
          { label: '逆风翻盘', description: '运动赛事主题曲', values: { prompt: '写一首逆风翻盘主题曲歌词，适合运动赛事剪辑', style: 'rock', structure: '标准结构' } }
        ]
      },
      {
        category: '风格实验',
        items: [
          { label: '国风江湖', description: '古风叙事', values: { prompt: '写一首国风江湖歌词，主题是刀光剑影与少年意气', style: 'folk', structure: '完整结构' } },
          { label: '都市说唱', description: '街头观察', values: { prompt: '写一首都市说唱歌词，围绕打工人的通勤、压力和自嘲', style: 'rap', structure: '主歌-副歌-主歌-副歌' } },
          { label: '电子情绪', description: '适合 synth-pop', values: { prompt: '写一首适合电子流行风格的歌词，主题是虚拟世界中的真实情感', style: 'pop', structure: '标准结构' } },
          { label: '民谣故事', description: '小镇回忆', values: { prompt: '写一首小镇回忆主题的民谣歌词，有生活细节和旧时光感', style: 'folk', structure: '简单结构' } }
        ]
      }
    ],
    music: [
      {
        category: '纯音乐场景',
        items: [
          { label: '夜读 Lo-fi', description: '夜晚学习背景音乐', values: { prompt: '一段温暖的中文 lo-fi 流行纯音乐，适合夜晚学习', style: 'electronic', bpm: '中速 (90-120)', key: 'C大调', duration: '30秒' } },
          { label: '武侠古风', description: '古筝与笛子', values: { prompt: '纯音乐，古风武侠氛围，古筝与竹笛，山雨欲来', style: 'classical', bpm: '慢速 (60-80)', key: 'A小调', duration: '1分钟' } },
          { label: '咖啡馆爵士', description: '午后轻松氛围', values: { prompt: '纯音乐，适合咖啡馆午后播放的轻爵士，温暖松弛', style: 'jazz', bpm: '中速 (90-120)', key: 'G大调', duration: '1分钟' } },
          { label: '赛博电子', description: '未来感片头', values: { prompt: '纯音乐，赛博朋克城市夜景，霓虹感强，适合科技产品片头', style: 'electronic', bpm: '快速 (130-160)', key: 'D小调', duration: '30秒' } }
        ]
      },
      {
        category: '歌词成曲',
        items: [
          { label: '毕业合唱', description: '带人声的流行歌', values: { prompt: '[Verse]\n教室的风吹过窗台\n白纸上写着未来\n[Chorus]\n我们终会奔向人海\n但青春永远不会散开', style: 'pop', bpm: '中速 (90-120)', key: 'C大调', duration: '1分钟' } },
          { label: '摇滚燃点', description: '热血主歌副歌', values: { prompt: '[Verse]\n逆风而行也不回头\n脚下尘土都是自由\n[Chorus]\n把名字刻进高空\n让世界听见怒吼', style: 'rock', bpm: '快速 (130-160)', key: 'E大调', duration: '1分钟' } },
          { label: '城市民谣', description: '真实生活细节', values: { prompt: '[Verse]\n最后一班车穿过雨夜\n便利店的灯还没灭\n[Chorus]\n你说生活总有缺口\n但也总有人为你停留', style: 'folk', bpm: '慢速 (60-80)', key: 'A小调', duration: '1分钟' } },
          { label: '说唱情绪', description: '都市感节奏', values: { prompt: '[Verse]\n地铁站里每张脸都写着加速\n手机屏幕反光像城市的脉冲\n[Chorus]\n但我还是想把真心交给节奏\n让每一句都落在今晚风中', style: 'hiphop', bpm: '快速 (130-160)', key: 'D小调', duration: '30秒' } }
        ]
      },
      {
        category: '商业用途',
        items: [
          { label: '品牌广告', description: '轻快明亮', values: { prompt: '纯音乐，轻快明亮，适合新消费品牌 15 秒广告结尾', style: 'pop', bpm: '中速 (90-120)', key: 'G大调', duration: '30秒' } },
          { label: 'App 开屏', description: '科技高级感', values: { prompt: '纯音乐，科技高级感，适合 AI 应用开屏和产品发布会', style: 'electronic', bpm: '中速 (90-120)', key: 'C小调', duration: '30秒' } },
          { label: 'Vlog 配乐', description: '旅行记录', values: { prompt: '纯音乐，适合旅行 vlog，阳光、开阔、自由', style: 'folk', bpm: '中速 (90-120)', key: 'D大调', duration: '1分钟' } },
          { label: '课程片头', description: '知识博主', values: { prompt: '纯音乐，适合知识博主课程片头，稳定、专业、值得信赖', style: 'classical', bpm: '慢速 (60-80)', key: 'C大调', duration: '30秒' } }
        ]
      }
    ],
    cover: [
      {
        category: '专辑封面',
        items: [
          { label: '霓虹流行', description: '都市流行封面', values: { prompt: '赛博朋克城市夜景专辑封面，霓虹灯，电影感，中文流行音乐', ratio: '1:1', style: '赛博朋克' } },
          { label: '民谣写真', description: '胶片与草地', values: { prompt: '民谣专辑封面，胶片摄影感，傍晚草地与旧木吉他，留白设计', ratio: '3:4', style: '写实摄影' } },
          { label: '电子极简', description: '高级几何构图', values: { prompt: '电子音乐 EP 封面，黑底，金属几何形体，极简高级感', ratio: '1:1', style: '极简几何' } },
          { label: '动漫梦境', description: '轻幻想风', values: { prompt: '梦境感二次元音乐封面，星空、漂浮列车、少女背影', ratio: '3:4', style: '水彩' } }
        ]
      },
      {
        category: '品牌视觉',
        items: [
          { label: '科技发布会', description: '发布会 KV', values: { prompt: 'AI 产品发布会主视觉，未来感渐变背景，发光网格与悬浮界面', ratio: '16:9', style: '赛博朋克' } },
          { label: '播客封面', description: '知识访谈节目', values: { prompt: '中文商业播客封面，稳重专业，蓝金配色，留标题空间', ratio: '1:1', style: '极简几何' } },
          { label: '课程海报', description: '线上课程宣传图', values: { prompt: 'AI 实战课程封面海报，现代、专业、有转化感，适合知识付费', ratio: '16:9', style: '写实摄影' } },
          { label: '活动 banner', description: '社群活动视觉', values: { prompt: '音乐创作者社群活动 banner，热闹、创意、灯光舞台元素', ratio: '16:9', style: '油画' } }
        ]
      },
      {
        category: '实验风格',
        items: [
          { label: '像素复古', description: '游戏 OST 封面', values: { prompt: '复古像素艺术风格游戏原声封面，8-bit 城市与夜空', ratio: '1:1', style: '像素艺术' } },
          { label: '油画人像', description: '独立音乐人', values: { prompt: '独立音乐人专辑封面，厚涂油画风半身像，强烈光影', ratio: '3:4', style: '油画' } },
          { label: '极简黑白', description: '先锋实验音乐', values: { prompt: '先锋实验音乐封面，黑白高对比，粗粝纹理与留白排版', ratio: '1:1', style: '极简几何' } },
          { label: '水彩诗意', description: '轻柔治愈感', values: { prompt: '诗意水彩风音乐封面，湖面、远山、晨雾、柔和配色', ratio: '3:4', style: '水彩' } }
        ]
      }
    ],
    speech: [
      {
        category: '商业播报',
        items: [
          { label: '欢迎语', description: '产品首页欢迎词', values: { text: '你好，欢迎使用 AI 内容生成站。现在你可以在这里完成对话、歌词、图片、音乐、翻唱和语音创作。', voice_id: 'male-qn-qingse', emotion: 'happy', speed: 1, pitch: 1, vol: 50, output_format: 'mp3' } },
          { label: '课程开场', description: '知识博主片头', values: { text: '欢迎来到今天的 AI 实战课程，我们会用最少的时间，带你跑通从需求到上线的完整流程。', voice_id: 'Chinese (Mandarin)_Lyrical_Voice', emotion: 'fluent', speed: 1, pitch: 1, vol: 55, output_format: 'mp3' } },
          { label: '客服播报', description: '售后通知', values: { text: '您好，您提交的问题已经收到，我们会在一个工作日内完成处理，并通过短信通知您结果。', voice_id: 'female-tianmei', emotion: 'calm', speed: 0.9, pitch: 1, vol: 50, output_format: 'wav' } },
          { label: '活动主持', description: '线下活动串场', values: { text: '接下来让我们欢迎下一位分享嘉宾登场，他将带来关于 AI 与内容创作结合的最新实践。', voice_id: 'male-qn-qingse', emotion: 'surprised', speed: 1.1, pitch: 1, vol: 60, output_format: 'mp3' } }
        ]
      },
      {
        category: '情绪表达',
        items: [
          { label: '晚安电台', description: '治愈感低语', values: { text: '如果你今天有一点累，那就把世界调低一点音量。今晚先好好休息，明天再继续发光。', voice_id: 'Chinese (Mandarin)_Lyrical_Voice', emotion: 'whisper', speed: 0.8, pitch: 0.9, vol: 40, output_format: 'mp3' } },
          { label: '激励口播', description: '鼓舞士气', values: { text: '别因为走得慢就怀疑自己，你已经比昨天更靠近目标。继续向前，答案会在路上出现。', voice_id: 'English_Persuasive_Man', emotion: 'happy', speed: 1.1, pitch: 1, vol: 60, output_format: 'mp3' } },
          { label: '故事朗读', description: '温柔叙述', values: { text: '那年夏天，风吹过河堤，天空很蓝，我们都还相信未来会像电影里一样闪闪发光。', voice_id: 'female-tianmei', emotion: 'sad', speed: 0.95, pitch: 1.1, vol: 50, output_format: 'wav' } },
          { label: '诗词朗诵', description: '古典氛围', values: { text: '春风又绿江南岸，明月何时照我还。山水有相逢，愿君多珍重。', voice_id: 'Chinese (Mandarin)_HK_Flight_Attendant', emotion: 'calm', speed: 0.85, pitch: 1, vol: 50, output_format: 'mp3' } }
        ]
      }
    ],
    covervoice: [
      {
        category: '常见翻唱',
        items: [
          { label: '磁性男声', description: '成熟流行风', values: { prompt: '成熟稳重的磁性男声，中文流行风格，情绪克制但有张力', timbre: '磁性男声', pitch: '' } },
          { label: '清亮女声', description: '透明治愈感', values: { prompt: '清亮通透的女声，轻柔治愈，适合抒情流行情歌', timbre: '清澈女声', pitch: '+3' } },
          { label: '甜美女声', description: '轻快明亮', values: { prompt: '甜美女声，青春感强，适合轻快恋爱风歌曲', timbre: '甜美女声', pitch: '+5' } },
          { label: '低沉男声', description: '欧美流行感', values: { prompt: '低沉男声，欧美流行质感，带一点沙哑和呼吸感', timbre: '低沉男声', pitch: '-3' } }
        ]
      },
      {
        category: '风格迁移',
        items: [
          { label: '动漫少年音', description: '日系清爽风', values: { prompt: '清亮少年音，带一点日系动漫主题曲的热血感', timbre: '中性嗓音', pitch: '+3' } },
          { label: 'R&B 女声', description: '松弛律动', values: { prompt: '慵懒性感的 R&B 女声，律动感强，尾音自然滑入', timbre: '清澈女声', pitch: '' } },
          { label: '舞台摇滚', description: '更炸更有张力', values: { prompt: '摇滚舞台感男声，情绪外放，副歌爆发力强', timbre: '低沉男声', pitch: '' } },
          { label: '治愈电台', description: '贴耳细腻', values: { prompt: '像深夜电台主播一样贴耳、温柔、安静的翻唱效果', timbre: '中性嗓音', pitch: '-5' } }
        ]
      }
    ]
  };

  function createMemoryStorage() {
    const data = new Map();
    return {
      getItem(key) {
        return data.has(key) ? data.get(key) : null;
      },
      setItem(key, value) {
        data.set(key, String(value));
      },
      removeItem(key) {
        data.delete(key);
      }
    };
  }

  function authenticate(username, password) {
    return username === AUTH.username && password === AUTH.password;
  }

  function buildKey(parts) {
    return [STORAGE_PREFIX].concat(parts).join('.');
  }

  function safeParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function normalizeConversationTitle(title) {
    const normalized = String(title || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '新对话';
    return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
  }

  function filterConversationSummaries(items, query) {
    const collection = Array.isArray(items) ? items.slice() : [];
    const normalizedQuery = String(query || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalizedQuery) return collection;

    const terms = normalizedQuery.split(' ').filter(Boolean);
    return collection.filter(item => {
      const haystack = [
        item?.title || '',
        item?.model || ''
      ].join(' ').toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }

  function createPersistence(storage) {
    return {
      loadSession() {
        return safeParse(storage.getItem(buildKey(['session'])), null);
      },
      saveSession(session) {
        storage.setItem(buildKey(['session']), JSON.stringify(session));
      },
      clearSession() {
        storage.removeItem(buildKey(['session']));
      },
      getHistory(username, feature) {
        return safeParse(storage.getItem(buildKey(['history', username, feature])), []);
      },
      saveHistory(username, feature, entries) {
        storage.setItem(buildKey(['history', username, feature]), JSON.stringify(entries.slice(0, MAX_HISTORY_ITEMS)));
      },
      appendHistory(username, feature, entry) {
        const existing = this.getHistory(username, feature);
        const next = [entry].concat(existing).slice(0, MAX_HISTORY_ITEMS);
        this.saveHistory(username, feature, next);
        return next;
      },
      getConversations(username) {
        return safeParse(storage.getItem(buildKey(['conversations', username])), []);
      },
      saveConversations(username, conversations) {
        storage.setItem(buildKey(['conversations', username]), JSON.stringify(conversations || []));
      },
      getArchivedConversations(username) {
        return safeParse(storage.getItem(buildKey(['archived-conversations', username])), []);
      },
      listArchivedConversations(username) {
        return this.getArchivedConversations(username);
      },
      saveArchivedConversations(username, conversations) {
        storage.setItem(buildKey(['archived-conversations', username]), JSON.stringify(conversations || []));
      },
      createConversation(username, payload = {}) {
        const now = Date.now();
        const existing = this.getConversations(username);
        const conversation = {
          id: `conv-${now}`,
          title: normalizeConversationTitle(payload.title || '新对话'),
          model: payload.model || 'MiniMax-M2.7',
          messageCount: 0,
          lastMessageAt: null,
          createdAt: now,
          updatedAt: now
        };
        this.saveConversations(username, [conversation].concat(existing));
        this.saveConversationMessages(username, conversation.id, []);
        return conversation;
      },
      getConversation(username, conversationId) {
        return this.getConversations(username).find(item => item.id === conversationId) || null;
      },
      getConversationMessages(username, conversationId) {
        return safeParse(storage.getItem(buildKey(['conversation-messages', username, conversationId])), []);
      },
      saveConversationMessages(username, conversationId, messages) {
        storage.setItem(buildKey(['conversation-messages', username, conversationId]), JSON.stringify(messages || []));
      },
      updateConversation(username, conversationId, patch = {}) {
        const conversations = this.getConversations(username);
        const existing = conversations.find(item => item.id === conversationId);
        if (!existing) return { conversation: null };

        const updated = {
          ...existing,
          title: Object.prototype.hasOwnProperty.call(patch, 'title')
            ? normalizeConversationTitle(patch.title)
            : existing.title,
          model: Object.prototype.hasOwnProperty.call(patch, 'model') && String(patch.model || '').trim()
            ? String(patch.model || '').trim()
            : existing.model,
          updatedAt: Date.now()
        };

        this.saveConversations(username, conversations.map(item => item.id === conversationId ? updated : item));
        return { conversation: updated };
      },
      archiveConversation(username, conversationId) {
        const conversations = this.getConversations(username);
        const archived = conversations.find(item => item.id === conversationId);
        const archivedConversations = this.getArchivedConversations(username);
        const remaining = conversations.filter(item => item.id !== conversationId);
        const archivedItem = archived
          ? {
              ...archived,
              archivedAt: Date.now(),
              updatedAt: Date.now()
            }
          : null;
        this.saveConversations(username, remaining);
        if (archivedItem) {
          this.saveArchivedConversations(username, [archivedItem].concat(archivedConversations.filter(item => item.id !== archivedItem.id)));
        }
        return {
          archivedConversationId: archived?.id || conversationId,
          archivedConversation: archivedItem,
          conversations: remaining,
          archivedConversations: archivedItem
            ? [archivedItem].concat(archivedConversations.filter(item => item.id !== archivedItem.id))
            : archivedConversations
        };
      },
      restoreConversation(username, conversationId) {
        const conversations = this.getConversations(username);
        const archivedConversations = this.getArchivedConversations(username);
        const archived = archivedConversations.find(item => item.id === conversationId);
        if (!archived) {
          return { conversation: null, conversations, archivedConversations };
        }

        const restoredConversation = {
          ...archived,
          archivedAt: null,
          updatedAt: Date.now()
        };
        const nextArchivedConversations = archivedConversations.filter(item => item.id !== conversationId);
        const nextConversations = [restoredConversation].concat(conversations.filter(item => item.id !== conversationId));

        this.saveConversations(username, nextConversations);
        this.saveArchivedConversations(username, nextArchivedConversations);

        return {
          conversation: restoredConversation,
          conversations: nextConversations,
          archivedConversations: nextArchivedConversations
        };
      },
      deleteArchivedConversation(username, conversationId) {
        const conversations = this.getConversations(username);
        const archivedConversations = this.getArchivedConversations(username);
        const archived = archivedConversations.find(item => item.id === conversationId);
        if (!archived) {
          return {
            deletedConversation: null,
            deletedConversationId: conversationId,
            conversations,
            archivedConversations
          };
        }

        const nextArchivedConversations = archivedConversations.filter(item => item.id !== conversationId);
        this.saveArchivedConversations(username, nextArchivedConversations);

        return {
          deletedConversation: archived,
          deletedConversationId: conversationId,
          conversations,
          archivedConversations: nextArchivedConversations
        };
      }
    };
  }

  function createRemotePersistence(fetchImpl) {
    function notifyAuthExpired(detail) {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      const eventDetail = detail || {};
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('app-auth-expired', { detail: eventDetail }));
        return;
      }
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('app-auth-expired', { detail: eventDetail }));
        return;
      }
      window.dispatchEvent({ type: 'app-auth-expired', detail: eventDetail });
    }

    function notifyPasswordResetRequired(detail) {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      const eventDetail = detail || {};
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('app-password-reset-required', { detail: eventDetail }));
        return;
      }
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('app-password-reset-required', { detail: eventDetail }));
        return;
      }
      window.dispatchEvent({ type: 'app-password-reset-required', detail: eventDetail });
    }

    async function parseResponse(response) {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.reason = data.reason || null;
        error.user = data.user || null;
        if (response.status === 401) {
          notifyAuthExpired({
            status: response.status,
            reason: data.reason || 'session_expired',
            message: data.error || '登录状态已失效，请重新登录'
          });
        } else if (response.status === 403 && data.reason === 'password_reset_required') {
          notifyPasswordResetRequired({
            status: response.status,
            reason: data.reason,
            message: data.error || '请先修改临时密码后再继续使用',
            user: data.user || null
          });
        }
        throw error;
      }
      return data;
    }

    return {
      async loadSession() {
        const response = await fetchImpl('/api/auth/session', { credentials: 'same-origin' });
        if (response.status === 401) {
          return null;
        }
        const data = await parseResponse(response);
        return data.user || null;
      },

      async login(username, password) {
        const response = await fetchImpl('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await parseResponse(response);
        return data.user || null;
      },

      async register(payload) {
        const response = await fetchImpl('/api/auth/register', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {})
        });
        const data = await parseResponse(response);
        return data.user || null;
      },

      async logout() {
        const response = await fetchImpl('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        });
        await parseResponse(response);
      },

      async changePassword(payload) {
        const response = await fetchImpl('/api/auth/change-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await parseResponse(response);
        return {
          user: data.user || null,
          sessionRetained: Boolean(data.sessionRetained)
        };
      },

      async getInvitationSession(token) {
        const params = new URLSearchParams();
        if (token != null && token !== '') params.set('token', String(token));
        const response = await fetchImpl(`/api/auth/invitation?${params.toString()}`, {
          credentials: 'same-origin'
        });
        return parseResponse(response);
      },

      async activateInvitation(token, password) {
        const response = await fetchImpl('/api/auth/invitation/activate', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
        const data = await parseResponse(response);
        return {
          user: data.user || null
        };
      },

      async requestPasswordReset(username) {
        const response = await fetchImpl('/api/auth/forgot-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        return parseResponse(response);
      },

      async getPasswordResetSession(token) {
        const params = new URLSearchParams();
        if (token != null && token !== '') params.set('token', String(token));
        const response = await fetchImpl(`/api/auth/password-reset?${params.toString()}`, {
          credentials: 'same-origin'
        });
        return parseResponse(response);
      },

      async completePasswordReset(token, password) {
        const response = await fetchImpl('/api/auth/password-reset/complete', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
        const data = await parseResponse(response);
        return {
          user: data.user || null
        };
      },

      async getHistory(username, feature) {
        const response = await fetchImpl(`/api/history/${feature}`, { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.items || [];
      },

      async appendHistory(username, feature, entry) {
        const response = await fetchImpl(`/api/history/${feature}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry })
        });
        const data = await parseResponse(response);
        return data.items || [];
      },

      async getPreferences() {
        const response = await fetchImpl('/api/preferences', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.preferences || {};
      },

      async savePreferences(patch) {
        const response = await fetchImpl('/api/preferences', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        const data = await parseResponse(response);
        return data.preferences || {};
      },

      async getUsageToday() {
        const response = await fetchImpl('/api/usage/today', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.usage || {};
      },

      async getTemplates(feature) {
        const response = await fetchImpl(`/api/templates/${feature}`, { credentials: 'same-origin' });
        return parseResponse(response);
      },

      async createTemplate(feature, template) {
        const response = await fetchImpl(`/api/templates/${feature}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template)
        });
        const data = await parseResponse(response);
        return data.template || null;
      },

      async toggleTemplateFavorite(feature, templateId) {
        const response = await fetchImpl(`/api/templates/${feature}/${templateId}/favorite`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        });
        return parseResponse(response);
      },

      async getAdminUsers() {
        const response = await fetchImpl('/api/admin/users', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.users || [];
      },

      async getAdminAuditLogs(query = {}) {
        const params = new URLSearchParams();
        Object.entries(query || {}).forEach(([key, value]) => {
          if (value == null || value === '') return;
          params.set(key, String(value));
        });
        const response = await fetchImpl(`/api/admin/audit-logs${params.toString() ? `?${params.toString()}` : ''}`, {
          credentials: 'same-origin'
        });
        return parseResponse(response);
      },

      async issueAdminInvitation(userId) {
        const response = await fetchImpl(`/api/admin/users/${userId}/invite`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async resendAdminInvitation(userId) {
        const response = await fetchImpl(`/api/admin/users/${userId}/invite-resend`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async revokeAdminInvitation(userId) {
        const response = await fetchImpl(`/api/admin/users/${userId}/invite-revoke`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async createAdminUser(payload) {
        const response = await fetchImpl('/api/admin/users', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await parseResponse(response);
        return data.user || null;
      },

      async updateAdminUser(userId, patch) {
        const response = await fetchImpl(`/api/admin/users/${userId}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        const data = await parseResponse(response);
        return data.user || null;
      },

      async resetAdminUserPassword(userId, password) {
        const response = await fetchImpl(`/api/admin/users/${userId}/password`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await parseResponse(response);
        return {
          user: data.user || null,
          sessionRetained: Boolean(data.sessionRetained)
        };
      },

      async getConversations() {
        const response = await fetchImpl('/api/conversations', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.conversations || [];
      },

      async listArchivedConversations() {
        const response = await fetchImpl('/api/conversations/archived', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.conversations || [];
      },

      async createConversation(payload = {}) {
        const response = await fetchImpl('/api/conversations', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await parseResponse(response);
        return {
          conversation: data.conversation || null,
          messages: data.messages || []
        };
      },

      async getConversation(conversationId) {
        const response = await fetchImpl(`/api/conversations/${conversationId}`, { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return {
          conversation: data.conversation || null,
          messages: data.messages || []
        };
      },

      async updateConversation(conversationId, patch = {}) {
        const response = await fetchImpl(`/api/conversations/${conversationId}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        const data = await parseResponse(response);
        return {
          conversation: data.conversation || null
        };
      },

      async archiveConversation(conversationId) {
        const response = await fetchImpl(`/api/conversations/${conversationId}/archive`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async restoreConversation(conversationId) {
        const response = await fetchImpl(`/api/conversations/${conversationId}/restore`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async deleteArchivedConversation(conversationId) {
        const response = await fetchImpl(`/api/conversations/${conversationId}/delete`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async sendChatMessage(payload) {
        const response = await fetchImpl('/api/chat', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return parseResponse(response);
      }
    };
  }

  return {
    AUTH,
    FEATURE_META,
    TEMPLATE_LIBRARY,
    MAX_HISTORY_ITEMS,
    STORAGE_PREFIX,
    authenticate,
    filterConversationSummaries,
    createMemoryStorage,
    createPersistence,
    createRemotePersistence
  };
});
