var ReplyEngine = {
    styleMap: {
        formal: '正式',
        humorous: '幽默',
        gentle: '温和',
        direct: '直接',
        witty: '机智'
    },

    SCORE: {
        EXACT_MATCH: 1000,
        SUBSTRING_BASE: 400,
        SUBSTRING_RATIO_BONUS: 200,
        SUBSTRING_LEN_RATIO_THRESHOLD: 0.3,
        DIRECT_WORD: 50,
        DIRECT_WORD_RATIO_BONUS: 150,
        PHRASE_BASE: 90,
        PHRASE_LENGTH_BONUS: 8,
        PHRASE_MAX_LENGTH: 8,
        KEYWORD_EXACT: 35,
        KEYWORD_RATIO_BONUS: 100,
        KEYWORD_SYNONYM: 15,
        STORED_KW_EXACT: 20,
        STORED_KW_RATIO_BONUS: 50,
        STORED_KW_SYNONYM: 10,
        REPLY_TEXT_MATCH: 6,
        JACCARD_BONUS: 60,
        JACCARD_THRESHOLD: 0.2,
        TAG_EXACT: 10,
        TAG_SYNONYM_BONUS: 0.5,
        SCENE_BOOST: 50,
        SCENE_PENALTY: -25,
        INTENT_PENALTY: -12,
        SCENE_KEYWORD: 4,
        USER_RATING: 0.2,
        USE_COUNT: 0.05,
        USE_COUNT_MAX: 2,
        VOTE_BONUS: 0.1,
        LOW_QUALITY_PENALTY: -500,
        PRIORITY_WEIGHT: 50,
        NEGATIVE_FILTER_PENALTY: -300,
    },

    CONFIDENCE_THRESHOLD: 50,

    getClarificationPrompt(intentName) {
        const prompts = {
            workplace: [
                { tone: 'professional', text: '您提到的职场场景我需要更多细节。是领导、同事还是客户相关的？具体说了什么？' },
                { tone: 'warm', text: '职场沟通确实需要技巧，能告诉我对方是谁、在什么情况下说的吗？' },
                { tone: 'concise', text: '请补充：对方身份、具体场景、您的目标。' },
                { tone: 'humorous', text: '职场如战场，我需要更多情报才能帮您出招！对方是谁？说了啥？😄' },
                { tone: 'empathetic', text: '我理解职场沟通的压力，能多说一点具体情况吗？这样我才能给出最贴切的建议。' },
            ],
            relationship: [
                { tone: 'professional', text: '关于感情方面的问题，我需要了解是恋爱、家庭还是朋友关系？对方具体说了什么？' },
                { tone: 'warm', text: '感情的事最需要用心回应，能告诉我对方是谁、说了什么吗？' },
                { tone: 'concise', text: '请补充：关系类型、对方原话、您想达到的效果。' },
                { tone: 'humorous', text: '感情题比数学题难多了😄 多给我点线索：谁说的？什么情况？' },
                { tone: 'empathetic', text: '我感受到您想好好回应对方，能告诉我更多细节吗？这样我才能给出最暖心的建议。' },
            ],
            family: [
                { tone: 'professional', text: '家庭关系的问题我需要更多背景。是父母长辈、伴侣家人还是亲子方面？' },
                { tone: 'warm', text: '家人的话有时候最让人纠结，能告诉我具体是谁、说了什么吗？' },
                { tone: 'concise', text: '请补充：家庭成员、具体场景、矛盾焦点。' },
                { tone: 'humorous', text: '家家有本难念的经😄 告诉我是哪一页，我帮您翻过去！' },
                { tone: 'empathetic', text: '家庭关系确实需要更多耐心和智慧，能多说说具体情况吗？' },
            ],
            default: [
                { tone: 'professional', text: '我需要更多信息才能给出精准建议。您能描述一下具体的对话场景吗？比如：是在职场、感情还是社交场合？' },
                { tone: 'warm', text: '我想帮您找到最合适的回复，能再多说一点背景吗？比如对方是谁、在什么情况下说的？' },
                { tone: 'concise', text: '信息不够精确，请补充：对话场景、对方身份、您的目标。' },
                { tone: 'humorous', text: '您这话说得也太含蓄了吧😄 我需要更多线索才能帮您出招！比如：谁说的？什么场合？' },
                { tone: 'empathetic', text: '我感受到您想找到好的回应方式。能告诉我更多细节吗？这样我才能给出最贴心的建议。' },
            ],
        };
        const category = prompts[intentName] || prompts.default;
        return category[Math.floor(Math.random() * category.length)];
    },

    typoMap: {
        '领到': '领导', '老扳': '老板', '同是': '同事',
        '投述': '投诉', '客护': '客户', '甲言': '甲方',
        '谈叛': '谈判', '拒决': '拒绝', '倒歉': '道歉',
        '感蟹': '感谢', '夸jiang': '夸奖',
        '表百': '表白', '吵驾': '吵架', '分首': '分手',
        '安谓': '安慰', '家廷': '家庭', '亲纸': '亲子',
        '长悲': '长辈', '伴旅': '伴侣', '委挽': '委婉',
        '真城': '真诚', '赞没': '赞美', '幽墨': '幽默',
        '自朝': '自嘲', '尴介': '尴尬', '支迟': '支持',
        '理介': '理解', '期代': '期待', '信认': '信任',
        '尊仲': '尊重', '谦需': '谦虚', '包蓉': '包容',
        '嘲风': '嘲讽', '高纪': '高级', '微心': '微信',
        '焦律': '焦虑', '跨部们': '跨部门', '面视': '面试',
        '求只': '求职', '离值': '离职', '省职': '升职',
        '讲薪': '加薪', '催昏': '催婚', '婆息': '婆媳',
        '敬久': '敬酒', '借浅': '借钱', '减飞': '减肥',
        '社孔': '社恐', '汇抱': '汇报', '加办': '加班',
        '辞制': '辞职', '薪姿': '薪资', '沟同': '沟通',
        '协做': '协作', '压里': '压力', '内倦': '内卷',
        '摸鱼摸': '摸鱼', '阴阳怪起': '阴阳怪气',
    },

    colloquialMap: {
        '咋办': '怎么办', '咋整': '怎么办', '咋回事': '怎么回事',
        '啥意思': '什么意思', '啥情况': '什么情况', '干啥': '做什么',
        '咋说': '怎么说', '啥玩意': '什么东西', '咋回': '怎么回',
        '咋搞': '怎么搞', '咋弄': '怎么弄', '咋办呢': '怎么办',
        '烦死了': '很烦', '气死了': '很生气', '累死了': '很累',
        '急死了': '很急', '愁死了': '很愁', '无聊死了': '很无聊',
        '尴尬死了': '很尴尬', '吓死了': '很害怕',
        '怼我': '批评我', '被怼了': '被批评', '怼回去': '反驳回去',
        '杠精': '抬杠的人', '杠上了': '抬杠', '抬杠': '争论',
        '摸鱼': '偷懒', '划水': '偷懒', '躺平': '不努力',
        '摆烂': '放弃', '内卷': '过度竞争', '卷王': '过度竞争的人',
        '社死': '极度尴尬', '社恐': '社交恐惧', '社牛': '社交能力强',
        '破防了': '情绪崩溃', 'emo了': '情绪低落', 'emo': '情绪低落',
        '上头了': '冲动', '下头': '扫兴', '离谱': '不合理',
        '无语': '无奈', '绝了': '非常好或非常差',
        '甩锅': '推卸责任', '背锅': '承担责任', '甩不掉': '推不掉',
        '画大饼': '空口许诺', 'PUA': '精神控制', 'CPU': '精神控制',
        '绿茶': '虚伪的人', '白莲花': '装无辜',
        '不回我': '不回消息', '冷暴力': '冷战', '冷处理': '不理睬',
        '翻车': '失败', '踩雷': '遇到问题', '避雷': '避免问题',
        '种草': '推荐', '拔草': '取消推荐',
        '打工人': '上班族', '搬砖': '工作', '干饭': '吃饭',
        '搞钱': '赚钱', '搞事业': '专注工作',
        '好家伙': '惊讶', '我的天': '惊讶', '妈耶': '惊讶',
        '太绝了': '非常好', '绝绝子': '非常好',
        'YYDS': '最厉害', 'yyds': '最厉害',
        'nb': '厉害', 'NB': '厉害', '牛逼': '厉害',
        '拉胯': '表现差', '菜': '能力差', '菜鸡': '能力差的人',
        '鸡肋': '没什么用', '鸡同鸭讲': '沟通不畅',
        '老六': '不靠谱的人', '坑': '陷阱', '踩坑': '遇到问题',
        '不靠谱': '不可靠', '靠谱': '可靠',
        '心累': '精神疲惫', '心塞': '郁闷', '心凉': '失望',
        '扎心': '伤心', '戳心': '触动内心',
        '佛系': '不争不抢', '躺赢': '轻松获胜',
        '吃瓜': '旁观', '吃瓜群众': '旁观者',
        '带节奏': '引导舆论', '节奏大师': '引导舆论的人',
        '双标': '双重标准', '道德绑架': '用道德施压',
        '不香吗': '不好吗', '真香': '改变主意后觉得好',
    },

    negativeRules: [
        { whenIntent: 'workplace', excludeScenes: [41, 42, 43, 51, 52, 53, 66, 93] },
        { whenIntent: 'relationship', excludeScenes: [11, 12, 13, 14, 15, 21, 22, 23, 51, 52, 53, 94, 100, 102] },
        { whenIntent: 'family', excludeScenes: [41, 42, 66, 93, 21, 22, 23] },
        { whenIntent: 'customer', excludeScenes: [41, 42, 43, 51, 52, 53, 66, 93] },
        { whenIntent: 'comfort', excludeScenes: [11, 12, 13, 21, 22, 23, 61] },
        { whenIntent: 'sarcasm', excludeScenes: [41, 51, 52, 53, 63, 66, 88] },
    ],

    stopWords: new Set(['的','了','是','在','我','有','和','就','不','人','都','一','一个','上','也','很','到','说','要','去','你','会','着','没有','看','好','自己','这','他','她','它','们','那','些','什么','怎么','如何','可以','能','吗','吧','呢','啊','哦','嗯','呀','哈','嘛','啦','呗','把','被','让','给','对','从','向','与','但','而','或','如果','因为','所以','虽然','但是','然后','还是','已经','正在','将','应该','需要','必须','可能','大概','也许','比较','非常','特别','真的','确实','其实','当然','只是','不过','而且','并且','或者','以及','又','再','还','更','最','太','多','少','大','小','长','短','这个','那个','这些','那些','哪个','哪些','怎样','什么样','为什么','哪里','哪儿','什么时候','几','多少','第','次','下','中','里','外','前','后','左','右','间','旁','上面','下面','里面','外面','前面','后面','这边','那边','这里','那里','这样','那样','这么','那么','如此','为了','关于','通过','根据','按照','随着','当作','作为','像','比','同','跟','及','等','之','其','该','此','某','各','每','任','所有','任何','有些','有的','一些','一点','一下','一直','总是','从不','经常','往往','偶尔','有时','常常','渐渐','逐渐','慢慢','终于','果然','居然','竟然','忽然','突然','马上','立刻','立即','随即','接着','随后','之后','以后','此前','之前','以来','以内','以外','以下','以上','之间','左右','大约','差不多','几乎','简直','将近','约','超','过','不到','不足','整','足足','至少','至多','起码','仅仅','只','才','刚','正','恰','恰好','刚好','正好','恰巧','碰巧','想','问','告诉','觉得','知道','做','叫','时候','今天','明天','昨天','现在','的话','不是','没法','不能','不会','不知','不要','一样','一般','起来','出来','下来','上去','过来','回来','过去','出去','进来','进去','回去','上来','下去','那种','这种']),

    sceneKeywordMap: {
        '领导': [11], '老板': [11], '上司': [11], '经理': [11], '主管': [11], '老大': [11],
        '批评': [11, 94], '指责': [11, 94], '训斥': [11],
        '画饼': [11], '汇报': [11, 13], '认可': [11, 64],
        '方案': [11, 22, 23], '建议': [11, 85], '项目': [11, 22, 100], '进度': [11, 22, 100],
        '同事': [12, 100], '搭档': [12], '队友': [12], '同僚': [12],
        '抢功': [12], '帮忙': [12, 65], '合作': [12, 23, 100],
        '沟通': [12, 100, 97], '协调': [12, 100], '帮助': [81, 12],
        '抱怨': [12, 82],
        '开会': [13],
        '加班': [14], '熬夜': [14], '996': [14], '赶工': [14], '过劳': [14],
        '内卷': [14], '摸鱼': [14], '压力': [14, 99], '累': [14], '疲惫': [14],
        '请假': [14], '出差': [14],
        '辞职': [15, 102], '离职': [15, 102], '跳槽': [15, 102],
        '加薪': [15], '涨薪': [15], '涨工资': [15], '提薪': [15],
        '升职': [15], '晋升': [15], '催': [15, 52],
        '工资': [15, 94, 96], '待遇': [15, 94], '绩效': [15, 94], '考核': [15, 94],
        '投诉': [21], '差评': [21], '退款': [21], '售后': [21],
        '质量': [21, 22], '客户': [2, 21, 22, 23],
        '需求': [22], '变更': [22], '甲方': [22], '交付': [22, 23],
        '谈判': [23], '价格': [23], '砍价': [23], '报价': [23],
        '优惠': [23], '折扣': [23], '合同': [23],
        '聚会': [31, 101], '打招呼': [31, 101], '寒暄': [31, 101],
        '朋友': [31, 81], '介绍': [31, 102], '认识': [31], '迟到': [72, 31],
        '敬酒': [32], '劝酒': [32], '应酬': [32], '不想喝': [32], '不能喝': [32],
        '表白': [41, 66], '恋爱': [41, 93], '暧昧': [41], '约会': [41],
        '追求': [41], '暗恋': [41], '心动': [41], '撒娇': [41, 93], '哄': [41, 93],
        '礼物': [41, 66, 88], '单身': [41, 96], '相亲': [41, 96],
        '吵架': [42], '冷战': [42], '生气': [42], '吃醋': [42],
        '分手': [42, 43], '和好': [42], '误会': [42], '误解': [42],
        '闹矛盾': [42], '在乎': [42, 66], '不信任': [42, 84],
        '不喜欢': [61, 42], '不在乎': [42],
        '安慰': [43, 81], '难过': [43], '失恋': [43], '鼓励': [43, 81],
        '被欺负': [43, 95], '被针对': [43, 95],
        '委屈': [43, 99], '迷茫': [43, 99],
        '哭': [43], '伤心': [43], '低落': [43, 99],
        '孩子': [51], '成绩': [51], '叛逆': [51],
        '教育': [51], '辅导': [51], '作业': [51],
        '父母': [52], '长辈': [52], '催婚': [52, 96], '催生': [52, 96], '唠叨': [52],
        '孝顺': [52], '代沟': [52], '养老': [52], '不理解': [52, 82],
        '伴侣': [53], '家务': [53], '分担': [53], '辛苦': [53],
        '拒绝': [61], '借钱': [61], '推辞': [61], '不想': [61],
        '婉拒': [61], '说不': [61], '边界': [97, 61],
        '道歉': [62], '认错': [62], '对不起': [62, 87], '抱歉': [62],
        '弥补': [62], '失误': [62], '忘记': [72, 62], '原谅': [87, 62],
        '感谢': [63, 88], '谢谢': [63, 88], '感恩': [63, 88],
        '回馈': [63, 88], '答谢': [63], '感激': [88, 63], '回报': [88],
        '夸奖': [64, 86], '赞美': [64, 86], '表扬': [64],
        '谦虚': [64, 86], '低调': [64, 86],
        '关心': [65], '照顾': [65], '体贴': [65, 82],
        '问候': [65, 101], '陪伴': [81, 65], '倾听': [82, 65],
        '爱意': [66], '浪漫': [66], '甜蜜': [66], '承诺': [66, 87],
        '惊喜': [66, 83],
        '胖': [71], '矮': [71], '老': [71], '笨': [71], '穷': [71],
        '减肥': [71], '调侃': [71, 95], '自嘲': [71],
        '尴尬': [72], '冷场': [72], '说错话': [72], '圆场': [72],
        '创业': [81], '搬家': [81], '结婚': [81], '支持': [81],
        '理解': [82], '共情': [82], '认同': [82],
        '期待': [83], '未来': [83], '憧憬': [83], '计划': [83],
        '信任': [11, 84], '相信': [84], '依赖': [84], '托付': [84],
        '尊重': [85], '礼貌': [85], '谦逊': [85],
        '包容': [85, 87], '宽容': [87],
        '珍惜': [88],
        '话术': [91, 97], '替换': [91], '高情商': [91, 97],
        '低情商': [91], '话术升级': [91],
        '恋爱日常': [93], '对象': [93], '女朋友': [93], '男朋友': [93],
        '职场商务': [94], '薪资': [94], '职业规划': [94],
        '嘲讽': [95], '被怼': [95], '阴阳怪气': [95],
        '怼人': [95, 97], '回怼': [95, 97], '不带脏字': [95, 97],
        '嘴贱': [95], '抬杠': [95, 97], '管太宽': [61, 95],
        '说话难听': [95, 85], '人身攻击': [95, 61], '冒犯': [95, 85],
        '过年': [96], '亲戚': [96],
        '高级技巧': [97], '非暴力沟通': [97], '反问': [97],
        '接一否九': [97], '冷静反问': [97], '装傻': [97], '升维': [97],
        '微信': [98], '朋友圈': [98], '已读不回': [98],
        '群聊': [98], '拉黑': [98], '点赞': [98],
        '焦虑': [99], 'emo': [99], '烦躁': [99], '崩溃': [99],
        '情绪': [99], '心态': [99], '减压': [99],
        '跨部门': [100], '甩锅': [100, 12], '推诿': [100, 12],
        '协作': [100], '资源': [100], '流程': [100],
        '吃饭了吗': [101], '吃了吗': [101], '吃了没': [101], '吃饭没': [101], '在吗': [101],
        '你好': [101], '您好': [101], '嗨': [101], '哈喽': [101], 'Hi': [101], '嗨喽': [101],
        '早安': [101], '晚安': [101], '早上好': [101], '早晨好': [101], '早啊': [101], '早': [101],
        '晚上好': [101], '晚上': [101], '最近': [101], '最近怎么样': [101], '最近好吗': [101],
        '好久不见': [101], '最近忙吗': [101], '最近忙什么': [101], '在忙吗': [101],
        '面试': [102], '求职': [102], '应聘': [102], '简历': [102], 'HR': [102],
        '入职': [102], '试用期': [102], 'offer': [102],
        '自我介绍': [102], '离职原因': [102], '期望薪资': [102],
        '转行': [102], '跨行': [102], '空窗期': [102], '抗压能力': [102], '频繁跳槽': [102],
        '被催进度': [11, 94], '催进度': [11, 94], '优先级': [11, 100],
        '临时需求': [22, 100], '需求变更': [22, 100], '返工': [22, 100],
        '不配合': [12, 100], '对齐': [13, 100], '复盘': [13, 97],
        '不回消息': [98], '秒回': [98], '朋友圈评论': [98], '群里': [98],
        '破防': [99, 95], '内耗': [99], '失控': [99], '心累': [99, 43],
        '被误解': [42, 72, 85], '解释': [42, 85], '扫兴': [72, 85],
        '借车': [61], '借东西': [61], '推销': [61], '占便宜': [61, 95],
        '婆媳': [53], '家里人': [53, 52], '家务分配': [53],
        '生日': [66, 83, 88], '纪念日': [66, 83], '红包': [96, 88],
        '拒绝加微信': [61, 98], '不想加微信': [61, 98], '约饭': [31, 41, 61],
        '道德绑架': [52, 61, 95], '催回复': [98, 100], '催款': [23, 94],
        '借调': [100, 11], '背锅': [12, 100, 95], '抢话': [13, 72],
        '当众批评': [11, 95], '被夸年轻': [64, 86], '被夸漂亮': [64, 86],
        '不想聊天': [61, 93, 98], '分寸感': [85, 97], '冒犯问题': [95, 85],
        '结婚红包': [88, 96], '婚礼': [81, 88], '乔迁': [81, 88],
        '升学': [81, 88], '考试失利': [43, 51], '工作失误': [62, 11],
        '复合': [42, 87], '求复合': [42, 87], '见家长': [41, 52],
        '婆婆': [53, 52], '岳母': [53, 52], '伴手礼': [31, 88],
        '退群': [98, 61], '群通知': [98, 100], '催促付款': [23, 94],
        '客户改口': [22, 23], '客户失联': [21, 23], '被放鸽子': [62, 72],
        '被安排不合理工作': [11, 61], '工作交接': [12, 15, 100], '请示': [11],
        '日报': [13, 94], '周报': [13, 94], '复盘会': [13, 97],
        '客户催交付': [22, 21], '验收': [22, 23], '售前': [23, 94],
        '售后': [21], '邀约': [31, 41, 61], '临时爽约': [72, 62],
        '不熟': [31, 61], '饭局': [32, 31], '相处累': [42, 99],
        '缺安全感': [41, 42], '异地恋': [41, 93], '前任': [42, 93],
        '催学习': [51], '玩手机': [51], '婆媳矛盾': [53, 52],
        'AA': [31, 61], '收礼': [63, 88], '送礼': [88, 31],
        '请客': [31, 88], '社恐': [31, 99], '冷处理': [42, 97],
        '请教': [63, 85], '麻烦别人': [63, 85], '占用时间': [63, 85],
        '负能量': [99, 82], '自责': [99, 43], '被否定': [95, 43],
        '群公告': [98, 100], '撤回消息': [98, 72], '语音太长': [98, 85],
    },

    intentRules: [
        { name: 'apology', weight: 80, keywords: ['对不起', '抱歉', '不好意思', '道歉', '来晚', '迟到', '忘记', '失约'], sceneIds: [62, 87, 72] },
        { name: 'refusal', weight: 75, keywords: ['不方便', '没时间', '不想去', '不想借', '拒绝', '推辞', '婉拒', '帮不了', '借钱', '不还', '不好意思'], sceneIds: [61, 85] },
        { name: 'comfort', weight: 70, keywords: ['难过', '委屈', '崩溃', '想哭', '失落', '焦虑', '压力大', '心累'], sceneIds: [43, 82, 99] },
        { name: 'conflict', weight: 70, keywords: ['吵架', '生气', '冷战', '误会', '不理我', '不在乎', '被误解'], sceneIds: [42, 85, 87] },
        { name: 'workplace', weight: 65, keywords: ['领导', '老板', '同事', '项目', '进度', '加班', '绩效', '汇报', '面试', '升职', '加薪', '离职'], sceneIds: [11, 12, 13, 14, 94, 100] },
        { name: 'customer', weight: 65, keywords: ['客户', '甲方', '投诉', '需求', '变更', '退款', '报价', '合同'], sceneIds: [21, 22, 23] },
        { name: 'relationship', weight: 65, keywords: ['对象', '男朋友', '女朋友', '恋爱', '喜欢', '想我', '礼物', '纪念日'], sceneIds: [41, 66, 93] },
        { name: 'family', weight: 60, keywords: ['父母', '妈妈', '爸爸', '长辈', '孩子', '家务', '亲戚', '催婚'], sceneIds: [51, 52, 53, 96] },
        { name: 'online', weight: 55, keywords: ['微信', '朋友圈', '群聊', '不回消息', '已读不回', '拉黑', '评论'], sceneIds: [98, 101] },
        { name: 'sarcasm', weight: 65, keywords: ['嘲讽', '阴阳怪气', '被怼', '冒犯', '挖苦', '看不起'], sceneIds: [95, 71, 97] },
    ],

    cleanText(text) {
        if (!text) return '';
        return text.toLowerCase().replace(/[，。！？、""''：；～~\(\)（）\[\]【】{}<>《》…—\-_,\.!?;:'"「」\s]/g, '');
    },

    normalizeInput(text) {
        if (!text) return '';
        let normalized = text;
        for (const [typo, correct] of Object.entries(this.typoMap)) {
            if (normalized.includes(typo)) {
                normalized = normalized.replace(new RegExp(typo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
            }
        }
        for (const [slang, formal] of Object.entries(this.colloquialMap)) {
            if (normalized.includes(slang)) {
                normalized = normalized.replace(new RegExp(slang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), formal);
            }
        }
        return normalized;
    },

    getPhraseMatches(text) {
        const cleanAll = this.cleanText(text);
        if (!cleanAll) return [];
        const phraseSet = new Set();
        const knownPhrases = [
            ...Object.keys(this.sceneKeywordMap),
            ...this.intentRules.flatMap(rule => rule.keywords)
        ];
        for (const phrase of knownPhrases) {
            const cleanPhrase = this.cleanText(phrase);
            if (cleanPhrase.length >= 2 && cleanAll.includes(cleanPhrase)) {
                phraseSet.add(phrase.toLowerCase());
            }
        }
        return [...phraseSet].sort((a, b) => b.length - a.length);
    },

    getIntentMatches(inputText) {
        const cleanInput = this.cleanText(inputText);
        if (!cleanInput) return [];
        return this.intentRules.map(rule => {
            const hits = rule.keywords.filter(kw => cleanInput.includes(this.cleanText(kw)));
            const confidence = hits.length / rule.keywords.length;
            return { ...rule, hits, score: hits.length * rule.weight, confidence };
        }).filter(rule => rule.hits.length > 0)
          .sort((a, b) => b.score - a.score);
    },

    getDisplayKeywords(text) {
        if (!text) return [];
        const selected = new Set(this.getPhraseMatches(text).filter(item => item.length >= 2));
        if (selected.size >= 2) return [...selected].slice(0, 6);

        const chunks = text.split(/[，。！？、；…—\n,.;!?\s]/)
            .map(item => this.cleanText(item))
            .filter(item => item.length >= 2 && item.length <= 8 && !this.stopWords.has(item));
        chunks.forEach(item => selected.add(item));
        if (selected.size > 0) return [...selected].slice(0, 6);

        const cleanAll = this.cleanText(text);
        return cleanAll.length >= 2 && cleanAll.length <= 10 ? [cleanAll] : [];
    },

    analyzeConversation(inputText, sceneId = 0) {
        const cleanInput = this.cleanText(inputText);
        const displayKeywords = this.getDisplayKeywords(inputText);
        const intentMatches = this.getIntentMatches(inputText);
        const hasAny = (words) => words.some(word => cleanInput.includes(this.cleanText(word)));

        let intent = '对方希望被认真回应，而不是收到敷衍或生硬的标准答案。';
        let emotion = '试探、期待';
        let strategy = '先接住情绪，再给出态度或下一步行动。';
        let minefield = '别急着否定、讲大道理，也不要只回"嗯""随便""别想太多"。';

        if (hasAny(['难过', '委屈', '焦虑', '崩溃', '失眠', '自责', '内耗', '心累', '没用'])) {
            intent = '对方需要的不是解决方案优先，而是痛苦被看见、被理解。';
            emotion = '低落、脆弱、求安慰';
            strategy = '先命名情绪并陪伴，再轻轻给一个可执行的小出口。';
            minefield = '不要说"别想太多""你就是太敏感"，也别急着教育对方。';
        } else if (hasAny(['阴阳怪气', '嘲讽', '冒犯', '看不起', '否定', '调侃'])) {
            intent = '对方可能在试探你的边界、争夺话语权或释放攻击性。';
            emotion = '挑衅、轻视、试探';
            strategy = '不急着反击，先稳住姿态，再把话题拉回事实或边界。';
            minefield = '不要情绪化互怼，也别自我贬低来讨好对方。';
        } else if (hasAny(['拒绝', '不方便', '不想', '借钱', '加微信', '推销', '占用时间', '边界'])) {
            intent = '对方在请求资源或关系靠近，你需要既保留体面又守住边界。';
            emotion = '期待、试探';
            strategy = '用"感谢/理解+明确限制+替代方案"做到外圆内方。';
            minefield = '不要编复杂借口、过度道歉，或模糊答应让对方继续期待。';
        } else if (hasAny(['领导', '老板', '同事', '项目', '进度', '加班', '绩效', '汇报'])) {
            intent = '对方要的不是情绪表态，而是看到你的责任感、进度感和可控感。';
            emotion = hasAny(['催', '延期', '没进展', '风险', '批评']) ? '焦虑、施压' : '关注、试探';
            strategy = '用"理解诉求+同步事实+给出计划"来建立专业可信度。';
            minefield = '不要甩锅、抱怨、只说"我尽量"，也别在没方案时硬承诺。';
        } else if (hasAny(['客户', '甲方', '投诉', '退款', '验收', '报价', '合同', '交付', '压价'])) {
            intent = '对方想确认自己的利益被重视，也想看到明确、可靠的处理路径。';
            emotion = hasAny(['投诉', '退款', '催', '不满', '失联']) ? '不满、着急' : '谨慎、观望';
            strategy = '先安抚体验，再划清事实边界，最后给出下一步。';
            minefield = '不要直接说"不行""这是规定"，也别无限让步或含糊拖延。';
        } else if (hasAny(['对象', '男朋友', '女朋友', '恋爱', '爱不爱', '安全感', '不理我', '前任', '复合', '分手'])) {
            intent = '对方真正想确认的是：你在不在乎我、愿不愿意认真对待这段关系。';
            emotion = hasAny(['不理', '冷战', '前任', '分手', '复合']) ? '不安、委屈' : '期待、试探';
            strategy = '先确认关系价值，再解释事实，最后给出可感知的行动。';
            minefield = '不要冷处理、反问"你又怎么了"，也不要用理性分析压过感受。';
        } else if (hasAny(['父母', '长辈', '孩子', '亲戚', '婆婆', '家务', '催婚', '催生'])) {
            intent = '对方多半是在表达关心、控制感或希望被尊重的家庭位置。';
            emotion = hasAny(['催', '唠叨', '道德绑架', '顶嘴', '矛盾']) ? '焦虑、控制、委屈' : '关心、期待';
            strategy = '先承认关心或辛苦，再温和表达边界和共同目标。';
            minefield = '不要硬怼"你别管"，也别过度忍让到失去边界。';
        }

        if (intentMatches.length > 0 && displayKeywords.length > 0) {
            strategy += ' 关键词：' + displayKeywords.slice(0, 4).join('、') + '。';
        }

        return { intent, emotion, strategy, minefield };
    },

    getStrategyMeta(reply, index = 0, preferredKey = null) {
        const tags = (reply.tags || []).join(' ');
        const text = [reply.input, reply.reply, tags].join(' ');
        const clean = this.cleanText(text);
        const options = {
            A: {
                key: 'A',
                type: '共情安抚型',
                fit: '适用于对方情绪激动、委屈、求安慰时',
                analysis: '先把对方的感受接住，让对方觉得被看见，再把关系氛围稳下来。'
            },
            B: {
                key: 'B',
                type: '幽默化解型',
                fit: '适用于尴尬、轻微冒犯、日常闲聊破冰时',
                analysis: '用轻松表达降低紧张感，既不硬碰硬，也能把话题自然带走。'
            },
            C: {
                key: 'C',
                type: '温和坚定/专业型',
                fit: '适用于职场拒绝、谈判、确立边界时',
                analysis: '语气温和但边界清楚，既给对方面子，也把自己的立场说稳。'
            },
            D: {
                key: 'D',
                type: '反客为主/引导型',
                fit: '适用于需要掌握主动权、引导话题走向时',
                analysis: '通过提问、确认或下一步安排，把对话从情绪拉回可推进的方向。'
            }
        };

        const scores = { A: 0, B: 0, C: 0, D: 0 };
        const add = (key, points) => { scores[key] += points; };

        if (/(理解|懂你|辛苦|委屈|难过|焦虑|不容易|抱歉|对不起|谢谢|感谢|认可|信任|在乎|陪|安慰|心疼|失望)/.test(clean)) add('A', 7);
        if (/(幽默|自嘲|调侃|尴尬|冷场|圆场|玩笑|哈哈|开玩笑|轻松|气氛|救场|打趣)/.test(clean)) add('B', 8);
        if (/(不方便|拒绝|边界|原则|职责|责任|合同|价格|预算|薪资|加薪|交付|进度|项目|专业|质量|风险|优先级|安排|处理|落实|完成|同步|预计|确认后|礼貌|简洁|正式|不接收|不接受|自己有安排|谢谢关心不过|请尊重)/.test(clean)) add('C', 9);
        if (/(请教|想请教|能否|能不能|可否|是否|建议|方案|确认|复盘|下一步|怎么|如何|哪些|一起|看看|对齐|探讨|沟通|引导|反问)/.test(clean)) add('D', 7);

        if (reply.sceneId === 43 || reply.sceneId === 65 || reply.sceneId === 82 || reply.sceneId === 87) add('A', 3);
        if (reply.sceneId === 71 || reply.sceneId === 72 || reply.sceneId === 32) add('B', 3);
        if ([11, 12, 13, 14, 15, 21, 22, 23, 61, 94, 100, 102].includes(reply.sceneId)) add('C', 2);
        if ([13, 22, 83, 85, 97, 100].includes(reply.sceneId)) add('D', 2);

        if (preferredKey && scores[preferredKey] > 0) add(preferredKey, 2);

        const key = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] || ['A', 'B', 'C', 'D'][index % 4];
        const meta = { ...options[key] };

        if (key === 'A') {
            if (/(感谢|谢谢|认可|信任)/.test(clean)) {
                meta.analysis = '先回应对方的认可或善意，再表达会继续做好，让对方感到被尊重、被接住。';
            } else if (/(抱歉|对不起|道歉|伤到|失望)/.test(clean)) {
                meta.analysis = '先承认对方感受和自己的责任，降低防御感，再为后续修复留下空间。';
            } else {
                meta.analysis = '先命名情绪和处境，让对方感到"你懂我"，再轻轻给出支持。';
            }
        } else if (key === 'B') {
            if (/(自嘲|胖|矮|开不起玩笑|调侃)/.test(clean)) {
                meta.analysis = '用自嘲把攻击性变轻，同时不把自己放低，既保住体面也缓和气氛。';
            } else {
                meta.analysis = '用轻松措辞给紧张场面降温，把尴尬从"对立"转成"可继续聊"。';
            }
        } else if (key === 'C') {
            if (/(优先级|安排|进度|项目|交付|风险|预计|同步)/.test(clean)) {
                meta.analysis = '先接住任务或诉求，再给出进度、风险和下一步，体现可靠与可控。';
            } else if (/(不方便|拒绝|边界|责任|职责|原则)/.test(clean)) {
                meta.analysis = '先保留对方面子，再明确自己的限制，避免含糊答应造成后续消耗。';
            } else {
                meta.analysis = '表达克制但不退让，既维持关系，也把立场、标准或结果说清楚。';
            }
        } else if (key === 'D') {
            if (/(确认|请教|能否|是否|哪些)/.test(clean)) {
                meta.analysis = '用确认和请教把压力转成共同决策，让对方参与判断，减少单方面背责。';
            } else if (/(建议|方案|复盘|对齐|探讨)/.test(clean)) {
                meta.analysis = '把对话从情绪拉到方案，推动双方围绕事实、选择和下一步继续推进。';
            } else {
                meta.analysis = '通过提问或下一步安排拿回节奏，让对话朝更有建设性的方向走。';
            }
        }

        return meta;
    },

    hasLowQualityAttack(reply) {
        const text = [reply.input, reply.reply, (reply.keywords || []).join(' '), (reply.tags || []).join(' ')].join(' ');
        return /(驴踢|垃圾|白痴|智商|丑|滚|巴掌|闭嘴|喷粪|贱|蠢|不是人|上厕所|狗|马桶|奥利给|野鸡|化妆品|脑子进水|灰飞烟灭|别人说你黑|别人说你胖|别人说你矮|别人说你老|别人说你笨)/.test(text);
    },

    extractKeywords(text) {
        if (!text) return [];
        const result = [];
        result.push(...this.getPhraseMatches(text));
        const clauses = text.split(/[，。！？、；…—\n]/);
        for (const clause of clauses) {
            const cleaned = clause.replace(/[""''：～~\(\)（）\[\]【】{}<>《》\-_,\.!?;:'"「」\{\}]/g, ' ');
            const words = cleaned.split(/\s+/).filter(w => w.length > 0);
            for (const w of words) {
                if (w.length >= 2 && !this.stopWords.has(w)) {
                    result.push(w.toLowerCase());
                }
            }
            for (let i = 0; i < words.length - 1; i++) {
                const bigram = words[i] + words[i + 1];
                if (bigram.length >= 3 && bigram.length <= 6 && !this.stopWords.has(bigram)) {
                    result.push(bigram.toLowerCase());
                }
            }
        }
        const cleanAll = this.cleanText(text);
        if (cleanAll.length >= 2 && cleanAll.length <= 10) {
            result.push(cleanAll);
        }
        if (cleanAll.length > 4) {
            const knownPhrases = new Set(Object.keys(this.sceneKeywordMap).map(k => this.cleanText(k)));
            for (let len = 3; len <= Math.min(5, cleanAll.length); len++) {
                for (let i = 0; i <= cleanAll.length - len; i++) {
                    const sub = cleanAll.substring(i, i + len);
                    if (!this.stopWords.has(sub) && knownPhrases.has(sub)) {
                        result.push(sub);
                    }
                }
            }
        }
        return [...new Set(result)];
    },

    getSynonyms(word) {
        const wordLower = word.toLowerCase();
        if (this._synonymCache && this._synonymCache.has(wordLower)) {
            return this._synonymCache.get(wordLower);
        }
        const result = new Set();
        for (const [key, sceneIds] of Object.entries(this.sceneKeywordMap)) {
            if (key.toLowerCase() === wordLower) {
                result.add(key.toLowerCase());
            }
        }
        const synonymGroups = [
            ['领导', '老板', '上司', '经理', '主管', '老大'],
            ['同事', '搭档', '伙伴', '队友', '同僚'],
            ['加班', '熬夜', '过劳', '996', '赶工'],
            ['辞职', '离职', '跳槽', '走人', '不干了'],
            ['加薪', '涨薪', '涨工资', '提薪', '加工资'],
            ['升职', '晋升', '提拔', '高升', '升迁'],
            ['批评', '指责', '训斥', '骂', '说'],
            ['表扬', '夸奖', '认可', '称赞', '赞赏', '赞美'],
            ['拒绝', '推辞', '婉拒', '说不', '推脱'],
            ['道歉', '认错', '对不起', '抱歉', '赔不是'],
            ['感谢', '谢谢', '感恩', '感激', '道谢'],
            ['安慰', '开导', '鼓励', '劝慰', '宽慰'],
            ['吵架', '争执', '冲突', '拌嘴', '闹矛盾'],
            ['表白', '告白', '示爱', '表达心意'],
            ['分手', '分开', '散了', '结束关系'],
            ['约会', '见面', '约饭', '约出来'],
            ['催婚', '催结婚', '逼婚', '催嫁', '催娶'],
            ['投诉', '告状', '维权'],
            ['谈判', '协商', '商谈', '洽谈', '讨价还价'],
            ['面试', '求职', '应聘', '招聘'],
            ['聚会', '聚餐', '派对', '饭局', '酒局'],
            ['敬酒', '劝酒', '喝酒', '碰杯'],
            ['借钱', '贷款', '借我钱', '借点钱'],
            ['胖', '长胖', '发福', '圆润', '壮'],
            ['焦虑', '担心', '忧虑', '不安', '烦躁', '紧张'],
            ['压力', '负担', '重压', '压抑'],
            ['尴尬', '难堪', '窘迫', '下不来台'],
            ['质疑', '怀疑', '反对', '不认同', '挑战'],
            ['甩锅', '推卸', '推诿', '推脱', '嫁祸'],
            ['抢功', '占功劳', '冒领', '窃取成果'],
            ['画饼', '许诺', '空头支票', '忽悠'],
            ['内卷', '卷', '恶性竞争', '过度竞争'],
            ['摸鱼', '偷懒', '划水'],
            ['被怼', '被说', '被骂', '被嘲讽', '被攻击'],
            ['阴阳怪气', '冷嘲热讽', '含沙射影', '指桑骂槐'],
            ['迟到', '来晚了', '晚到', '来迟了'],
            ['想哭', '难过', '伤心', '崩溃', '委屈'],
            ['不开心', '不高兴', '心情不好', '郁闷', '低落'],
            ['生气', '发火', '发怒', '暴怒', '恼火'],
            ['误会', '误解', '错怪', '冤枉'],
            ['吃醋', '嫉妒', '酸', '小心眼'],
            ['冷战', '不说话', '不理人', '沉默'],
            ['被欺负', '被针对', '被排挤', '被刁难'],
            ['请假', '休假', '休息', '调休'],
            ['出差', '外派', '去外地'],
            ['减肥', '瘦身', '减脂', '节食'],
            ['不想喝', '不能喝', '喝不了', '不喝酒'],
            ['不知道聊什么', '没话题', '冷场', '没话说'],
            ['对象', '男朋友', '女朋友', '老公', '老婆', '爱人', '另一半'],
            ['孩子', '小孩', '宝宝', '儿子', '女儿'],
            ['父母', '爸妈', '爸爸妈妈', '家人', '家长'],
            ['你好', '您好', '嗨', '哈喽', 'Hi', '嗨喽', '早安', '晚安', '早上好', '早晨好', '早啊', '早', '晚上好'],
            ['最近', '最近怎么样', '最近好吗', '最近忙吗', '最近忙什么', '在忙吗', '好久不见'],
        ];
        for (const group of synonymGroups) {
            if (group.some(w => w.toLowerCase() === wordLower)) {
                group.forEach(w => {
                    if (w.toLowerCase() !== wordLower) result.add(w.toLowerCase());
                });
            }
        }
        if (!this._synonymCache) this._synonymCache = new Map();
        this._synonymCache.set(wordLower, result);
        return result;
    },

    _repliesCache: null,
    _scenesCache: null,
    _tagCloudCache: null,
    _synonymCache: null,

    async _getReplies() {
        if (!this._repliesCache) {
            this._repliesCache = await DB.getAll('replies');
        }
        return this._repliesCache;
    },

    async _getScenes() {
        if (!this._scenesCache) {
            this._scenesCache = await DB.getAll('scenes');
        }
        return this._scenesCache;
    },

    invalidateCache() {
        this._repliesCache = null;
        this._scenesCache = null;
        this._tagCloudCache = null;
        this._synonymCache = null;
    },

    async generateReplies(inputText, sceneId, style) {
        inputText = this.normalizeInput(inputText);

        const allReplies = await this._getReplies();
        const scenes = await this._getScenes();
        const sceneMap = {};
        scenes.forEach(s => { sceneMap[s.id] = s; });
        const getSceneAndDescendantIds = (id) => {
            const ids = new Set([id]);
            let changed = true;
            while (changed) {
                changed = false;
                for (const scene of scenes) {
                    if (ids.has(scene.parentId) && !ids.has(scene.id)) {
                        ids.add(scene.id);
                        changed = true;
                    }
                }
            }
            return ids;
        };

        const cleanInput = this.cleanText(inputText);
        const inputKeywords = this.extractKeywords(inputText);
        const inputKwSet = new Set(inputKeywords);

        const inputSynonymSet = new Set();
        for (const kw of inputKeywords) {
            const syns = this.getSynonyms(kw);
            syns.forEach(s => inputSynonymSet.add(s));
        }
        const inputPhraseMatches = this.getPhraseMatches(inputText);
        const intentMatches = this.getIntentMatches(inputText);
        const intentSceneBoost = new Map();
        for (const intent of intentMatches) {
            for (const sid of intent.sceneIds) {
                intentSceneBoost.set(sid, (intentSceneBoost.get(sid) || 0) + intent.score);
            }
        }

        const negativeExclusionSet = new Set();
        if (intentMatches.length > 0) {
            const topIntent = intentMatches[0];
            for (const rule of this.negativeRules) {
                if (rule.whenIntent === topIntent.name) {
                    rule.excludeScenes.forEach(sid => negativeExclusionSet.add(sid));
                }
            }
        }

        const inputSceneBoost = new Set();
        for (const kw of inputKeywords) {
            const mapped = this.sceneKeywordMap[kw] || this.sceneKeywordMap[kw.toUpperCase()] || this.sceneKeywordMap[kw.toLowerCase()];
            if (mapped) {
                mapped.forEach(sid => inputSceneBoost.add(sid));
            }
        }
        for (const syn of inputSynonymSet) {
            const mapped = this.sceneKeywordMap[syn] || this.sceneKeywordMap[syn.toUpperCase()] || this.sceneKeywordMap[syn.toLowerCase()];
            if (mapped) {
                mapped.forEach(sid => inputSceneBoost.add(sid));
            }
        }

        const inputWords = inputText.replace(/[，。！？、；…—\n""''：～~\(\)（）\[\]【】{}<>《》\-_,\.!?;:'"「」]/g, ' ')
            .split(/\s+/).filter(w => w.length >= 2 && !this.stopWords.has(w));

        const selectedSceneIds = sceneId && sceneId !== 0 ? getSceneAndDescendantIds(sceneId) : null;
        let candidates = selectedSceneIds
            ? allReplies.filter(r => selectedSceneIds.has(r.sceneId))
            : [...allReplies];

        const scored = candidates.map(reply => {
            if (!reply.input) return { ...reply, score: 0, matchLevel: 99 };

            const cleanReplyInput = this.cleanText(reply.input);
            const replyKeywords = this.extractKeywords(reply.input);
            const replyKwSet = new Set(replyKeywords);

            let score = 0;
            let bestLevel = 99;

            if (cleanReplyInput === cleanInput) {
                score += this.SCORE.EXACT_MATCH;
                bestLevel = 1;
            } else if (cleanReplyInput.length >= 2 && cleanInput.length >= 2) {
                if (cleanReplyInput.includes(cleanInput) || cleanInput.includes(cleanReplyInput)) {
                    const lenRatio = Math.min(cleanReplyInput.length, cleanInput.length) / Math.max(cleanReplyInput.length, cleanInput.length);
                    if (lenRatio > this.SCORE.SUBSTRING_LEN_RATIO_THRESHOLD) {
                        score += this.SCORE.SUBSTRING_BASE + lenRatio * this.SCORE.SUBSTRING_RATIO_BONUS;
                        bestLevel = 1;
                    }
                }
            }

            let directWordMatch = 0;
            for (const word of inputWords) {
                if (word.length >= 2 && reply.input.toLowerCase().includes(word.toLowerCase())) {
                    directWordMatch++;
                }
            }
            if (directWordMatch > 0) {
                const ratio = directWordMatch / Math.max(inputWords.length, 1);
                score += directWordMatch * this.SCORE.DIRECT_WORD + ratio * this.SCORE.DIRECT_WORD_RATIO_BONUS;
                if (bestLevel > 1) bestLevel = 1;
            }

            for (const phrase of inputPhraseMatches) {
                const phraseLower = phrase.toLowerCase();
                const cleanPhrase = this.cleanText(phraseLower);
                if (cleanPhrase.length < 2) continue;
                const phraseInInput = cleanReplyInput.includes(cleanPhrase);
                const phraseInKeywords = reply.keywords && reply.keywords.some(rk => this.cleanText(rk) === cleanPhrase);
                const phraseInTags = reply.tags && reply.tags.some(t => this.cleanText(t) === cleanPhrase);
                if (phraseInInput || phraseInKeywords || phraseInTags) {
                    score += this.SCORE.PHRASE_BASE + Math.min(cleanPhrase.length, this.SCORE.PHRASE_MAX_LENGTH) * this.SCORE.PHRASE_LENGTH_BONUS;
                    if (bestLevel > 1) bestLevel = 1;
                }
            }

            if (inputKwSet.size > 0 && replyKwSet.size > 0) {
                let exactMatchCount = 0;
                let synonymMatchCount = 0;

                for (const kw of replyKwSet) {
                    const kwLower = kw.toLowerCase();
                    if (inputKwSet.has(kwLower)) {
                        exactMatchCount++;
                    } else if (inputSynonymSet.has(kwLower)) {
                        synonymMatchCount++;
                    }
                }

                if (exactMatchCount > 0) {
                    const kwRatio = exactMatchCount / replyKwSet.size;
                    score += exactMatchCount * this.SCORE.KEYWORD_EXACT + kwRatio * this.SCORE.KEYWORD_RATIO_BONUS;
                    if (bestLevel > 2) bestLevel = 2;
                }

                if (synonymMatchCount > 0) {
                    score += synonymMatchCount * this.SCORE.KEYWORD_SYNONYM;
                    if (bestLevel > 3) bestLevel = 3;
                }
            }

            if (reply.keywords && reply.keywords.length > 0) {
                let storedKwMatch = 0;
                let storedSynMatch = 0;
                for (const kw of reply.keywords) {
                    const kwLower = kw.toLowerCase();
                    if (inputKwSet.has(kwLower)) {
                        storedKwMatch++;
                    } else if (inputSynonymSet.has(kwLower)) {
                        storedSynMatch++;
                    }
                }
                if (storedKwMatch > 0) {
                    const ratio = storedKwMatch / reply.keywords.length;
                    score += storedKwMatch * this.SCORE.STORED_KW_EXACT + ratio * this.SCORE.STORED_KW_RATIO_BONUS;
                    if (bestLevel > 2) bestLevel = 2;
                }
                if (storedSynMatch > 0) {
                    score += storedSynMatch * this.SCORE.STORED_KW_SYNONYM;
                    if (bestLevel > 3) bestLevel = 3;
                }
            }

            if (reply.reply && cleanInput.length > 1) {
                let replyTextMatch = 0;
                for (const kw of inputKeywords) {
                    if (kw.length >= 2 && reply.reply.toLowerCase().includes(kw.toLowerCase())) {
                        replyTextMatch++;
                    }
                }
                if (replyTextMatch > 0) {
                    score += replyTextMatch * this.SCORE.REPLY_TEXT_MATCH;
                    if (bestLevel > 4) bestLevel = 4;
                }
            }

            if (inputKwSet.size > 0 && replyKwSet.size > 0) {
                let exactIntersection = 0;
                let synonymBonus = 0;
                for (const item of inputKwSet) {
                    if (replyKwSet.has(item)) exactIntersection++;
                }
                if (inputSynonymSet.size > 0) {
                    for (const rk of replyKwSet) {
                        if (inputSynonymSet.has(rk) && !inputKwSet.has(rk)) {
                            synonymBonus += this.SCORE.TAG_SYNONYM_BONUS;
                        }
                    }
                }
                const union = inputKwSet.size + replyKwSet.size - exactIntersection;
                const sim = union > 0 ? exactIntersection / union : 0;

                if (sim > this.SCORE.JACCARD_THRESHOLD) {
                    score += sim * this.SCORE.JACCARD_BONUS + synonymBonus * this.SCORE.TAG_EXACT;
                    if (bestLevel > 3) bestLevel = 3;
                } else if (synonymBonus > 0) {
                    score += synonymBonus * this.SCORE.TAG_EXACT;
                    if (bestLevel > 4) bestLevel = 4;
                }
            }

            if (reply.tags && reply.tags.length > 0) {
                let tagMatchCount = 0;
                for (const tag of reply.tags) {
                    const tagLower = tag.toLowerCase();
                    if (inputKwSet.has(tagLower)) {
                        tagMatchCount++;
                    } else if (inputSynonymSet.has(tagLower)) {
                        tagMatchCount += this.SCORE.TAG_SYNONYM_BONUS;
                    }
                }
                if (tagMatchCount > 0) {
                    score += tagMatchCount * this.SCORE.TAG_EXACT;
                    if (bestLevel > 4) bestLevel = 4;
                }
            }

            if (inputSceneBoost.has(reply.sceneId)) {
                score += this.SCORE.SCENE_BOOST;
                if (bestLevel > 4) bestLevel = 4;
            } else if (inputSceneBoost.size > 0 && !inputSceneBoost.has(reply.sceneId)) {
                score += this.SCORE.SCENE_PENALTY;
            }

            if (intentSceneBoost.has(reply.sceneId)) {
                score += intentSceneBoost.get(reply.sceneId);
                if (bestLevel > 3) bestLevel = 3;
            } else if (intentSceneBoost.size > 0) {
                score += this.SCORE.INTENT_PENALTY;
            }

            if (!selectedSceneIds && negativeExclusionSet.has(reply.sceneId)) {
                score += this.SCORE.NEGATIVE_FILTER_PENALTY;
            }

            const scene = sceneMap[reply.sceneId];
            if (scene && scene.keywords && scene.keywords.length > 0) {
                let sceneMatchCount = 0;
                for (const kw of scene.keywords) {
                    const kwLower = kw.toLowerCase();
                    if (inputKwSet.has(kwLower)) {
                        sceneMatchCount++;
                    } else if (inputSynonymSet.has(kwLower)) {
                        sceneMatchCount += this.SCORE.TAG_SYNONYM_BONUS;
                    }
                }
                if (sceneMatchCount > 0) {
                    score += sceneMatchCount * this.SCORE.SCENE_KEYWORD;
                    if (bestLevel > 5) bestLevel = 5;
                }
            }

            if (reply.userRating) score += reply.userRating * this.SCORE.USER_RATING;
            if (reply.useCount) score += Math.min(reply.useCount * this.SCORE.USE_COUNT, this.SCORE.USE_COUNT_MAX);
            if (reply.votes) score += (reply.votes.up || 0) * this.SCORE.VOTE_BONUS;
            if (this.hasLowQualityAttack(reply)) score += this.SCORE.LOW_QUALITY_PENALTY;

            return { ...reply, score, matchLevel: bestLevel };
        });

        scored.sort((a, b) => {
            const priorityWeight = this.SCORE.PRIORITY_WEIGHT;
            const pA = a.score + (a.matchLevel < 99 ? (7 - a.matchLevel) * priorityWeight : 0);
            const pB = b.score + (b.matchLevel < 99 ? (7 - b.matchLevel) * priorityWeight : 0);
            return pB - pA;
        });

        const dedupeReplies = (items) => {
            const seen = new Set();
            return items.filter(item => {
                const key = this.cleanText(item.input || '') + '|' + this.cleanText(item.reply || '');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };

        let results = dedupeReplies(scored.filter(r => r.score > 0)).slice(0, 15);

        if (results.length < 5) {
            const existingIds = new Set(results.map(r => r.id));
            let fallbackSceneIds = new Set();
            for (const sid of inputSceneBoost) fallbackSceneIds.add(sid);
            for (const sid of intentSceneBoost.keys()) fallbackSceneIds.add(sid);
            if (selectedSceneIds) selectedSceneIds.forEach(sid => fallbackSceneIds.add(sid));
            const backup = dedupeReplies(scored.filter(r => {
                if (existingIds.has(r.id)) return false;
                if (fallbackSceneIds.size === 0) return true;
                return fallbackSceneIds.has(r.sceneId) || r.matchLevel < 99;
            }));
            for (const r of backup) {
                results.push(r);
                if (results.length >= 8) break;
            }
        }

        if (results.length === 0 && scored.length > 0) {
            results = dedupeReplies(scored).slice(0, 5);
        }

        let needsClarification = false;
        if (results.length > 0 && results[0].score < this.CONFIDENCE_THRESHOLD) {
            needsClarification = true;
        }

        const preferredKeys = ['A', 'B', 'C', 'D'];
        results = results.map((r, index) => {
            let replyText = r.reply;
            if (style && style !== 'formal' && r.styleVariants && r.styleVariants[style]) {
                replyText = r.styleVariants[style];
            }
            const matchedKws = [];
            for (const kw of inputKeywords) {
                const kwLower = kw.toLowerCase();
                if (r.input && r.input.toLowerCase().includes(kwLower)) {
                    matchedKws.push(kw);
                } else if (r.keywords && r.keywords.some(rk => rk.toLowerCase() === kwLower)) {
                    matchedKws.push(kw);
                } else if (r.tags && r.tags.some(t => t.toLowerCase() === kwLower)) {
                    matchedKws.push(kw);
                }
            }
            for (const intent of intentMatches) {
                intent.hits.forEach(hit => matchedKws.push(hit));
            }
            const strategy = this.getStrategyMeta(r, index, index < preferredKeys.length ? preferredKeys[index] : null);
            return {
                ...r,
                displayReply: replyText,
                displayStyle: style || 'formal',
                matchedKeywords: [...new Set(matchedKws)],
                strategy
            };
        });

        let clarificationPrompt = null;
        if (needsClarification) {
            const topIntentName = intentMatches.length > 0 ? intentMatches[0].name : 'default';
            clarificationPrompt = this.getClarificationPrompt(topIntentName);
        }

        return {
            replies: results,
            confidence: results.length > 0 ? results[0].score : 0,
            needsClarification,
            clarificationPrompt
        };
    },

    async suggestScenes(inputText) {
        inputText = this.normalizeInput(inputText);
        const scenes = await this._getScenes();
        const allReplies = await this._getReplies();
        const cleanInput = this.cleanText(inputText);
        const inputKeywords = this.extractKeywords(inputText);
        const inputKwSet = new Set(inputKeywords);
        const inputSynonymSet = new Set();
        for (const kw of inputKeywords) {
            this.getSynonyms(kw).forEach(s => inputSynonymSet.add(s));
        }
        const inputPhraseMatches = this.getPhraseMatches(inputText);
        const intentMatches = this.getIntentMatches(inputText);
        const intentSceneBoost = new Map();
        for (const intent of intentMatches) {
            for (const sid of intent.sceneIds) {
                intentSceneBoost.set(sid, (intentSceneBoost.get(sid) || 0) + intent.score);
            }
        }
        const scored = [];

        for (const scene of scenes) {
            let score = 0;

            if (intentSceneBoost.has(scene.id)) {
                score += intentSceneBoost.get(scene.id);
            }

            if (scene.keywords) {
                for (const kw of scene.keywords) {
                    const kwLower = kw.toLowerCase();
                    if (cleanInput.includes(kwLower)) {
                        score += this.SCORE.STORED_KW_EXACT;
                    } else if (inputSynonymSet.has(kwLower)) {
                        score += this.SCORE.STORED_KW_SYNONYM;
                    }
                }
            }

            for (const phrase of inputPhraseMatches) {
                const cleanPhrase = this.cleanText(phrase);
                if (!cleanPhrase) continue;
                const phraseInScene = (scene.keywords || []).some(kw => this.cleanText(kw) === cleanPhrase)
                    || (scene.tags || []).some(tag => this.cleanText(tag) === cleanPhrase)
                    || this.cleanText(scene.name).includes(cleanPhrase);
                if (phraseInScene) score += this.SCORE.PHRASE_BASE - this.SCORE.PHRASE_LENGTH_BONUS * 2 + Math.min(cleanPhrase.length, this.SCORE.PHRASE_MAX_LENGTH) * this.SCORE.PHRASE_LENGTH_BONUS / 2;
            }

            if (scene.tags) {
                for (const tag of scene.tags) {
                    if (inputText.includes(tag)) score += this.SCORE.TAG_EXACT;
                }
            }

            const sceneReplies = allReplies.filter(r => r.sceneId === scene.id);
            let bestReplyScore = 0;

            for (const reply of sceneReplies.slice(0, 50)) {
                if (reply.input) {
                    const cleanReplyInput = this.cleanText(reply.input);

                    if (cleanReplyInput === cleanInput) {
                        bestReplyScore = Math.max(bestReplyScore, this.SCORE.EXACT_MATCH / 5);
                    } else if (cleanInput.includes(cleanReplyInput) || cleanReplyInput.includes(cleanInput)) {
                        bestReplyScore = Math.max(bestReplyScore, this.SCORE.SUBSTRING_BASE / 4);
                    }

                    if (reply.keywords) {
                        let matchCount = 0;
                        for (const kw of reply.keywords) {
                            const kwLower = kw.toLowerCase();
                            if (cleanInput.includes(kwLower) || inputSynonymSet.has(kwLower)) matchCount++;
                        }
                        if (matchCount > 0) bestReplyScore = Math.max(bestReplyScore, matchCount * this.SCORE.STORED_KW_EXACT / 2);
                    }

                    if (inputKeywords.length > 0) {
                        const replyKeywords = this.extractKeywords(reply.input);
                        const replyKwSet = new Set(replyKeywords);
                        let intersection = 0;
                        for (const item of inputKwSet) {
                            if (replyKwSet.has(item)) intersection++;
                        }
                        const union = inputKwSet.size + replyKwSet.size - intersection;
                        const sim = union > 0 ? intersection / union : 0;
                        if (sim > this.SCORE.JACCARD_THRESHOLD - 0.05) bestReplyScore = Math.max(bestReplyScore, sim * this.SCORE.JACCARD_BONUS * 0.67);
                    }
                }
            }

            score += bestReplyScore;

            if (score > 0) {
                scored.push({ ...scene, score });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, 3);
    },

    async getTagCloud() {
        if (this._tagCloudCache) return this._tagCloudCache;
        const replies = await this._getReplies();
        const tagCount = {};
        for (const reply of replies) {
            if (reply.tags) {
                for (const tag of reply.tags) {
                    tagCount[tag] = (tagCount[tag] || 0) + 1;
                }
            }
        }
        const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
        const result = sorted.slice(0, 20).map(([tag, count]) => ({ tag, count }));
        this._tagCloudCache = result;
        return result;
    },

    async getSceneTree() {
        const scenes = await this._getScenes();
        const rootScenes = scenes.filter(s => !s.parentId || s.parentId === 0);
        const buildTree = (parentId) => {
            return scenes.filter(s => s.parentId === parentId).map(s => ({
                ...s,
                children: buildTree(s.id)
            }));
        };
        return rootScenes.map(s => ({ ...s, children: buildTree(s.id) }));
    },

    async recordUsage(replyId) {
        const reply = await DB.get('replies', replyId);
        if (reply) {
            reply.useCount = (reply.useCount || 0) + 1;
            await DB.put('replies', reply);
            this._repliesCache = null;
            this._scenesCache = null;
        }
    },

    async recordVote(replyId, voteType, isActive = false) {
        const reply = await DB.get('replies', replyId);
        if (reply) {
            if (!reply.votes) reply.votes = { up: 0, down: 0 };
            if (isActive) {
                reply.votes[voteType] = Math.max(0, (reply.votes[voteType] || 0) - 1);
                if (voteType === 'up') {
                    reply.userRating = Math.max(1, (reply.userRating || 4) - 0.1);
                } else {
                    reply.userRating = Math.min(5, (reply.userRating || 4) + 0.1);
                }
            } else {
                reply.votes[voteType] = (reply.votes[voteType] || 0) + 1;
                if (voteType === 'up') {
                    reply.userRating = Math.min(5, (reply.userRating || 4) + 0.1);
                } else {
                    reply.userRating = Math.max(1, (reply.userRating || 4) - 0.1);
                }
            }
            await DB.put('replies', reply);
            this._repliesCache = null;
            this._scenesCache = null;
            return reply.votes;
        }
        return null;
    },

    generateToneVariants(baseReply) {
        if (!baseReply) return {};
        const isQuestion = /[？?]$/.test(baseReply);
        const hasExclamation = /[！!]$/.test(baseReply);
        const isWorkplace = /领导|老板|同事|项目|汇报|进度|加班|绩效|客户|甲方|方案|任务|工作/.test(baseReply);
        const isRelationship = /喜欢|爱|想你|在乎|生气|吵架|哄|约会|表白|分手|和好|吃醋/.test(baseReply);
        const isSocial = /聚会|敬酒|应酬|寒暄|见面|打招呼|不熟|饭局/.test(baseReply);

        const transforms = {
            humorous: [
                [/[，,]我会继续努力/, '，我这就把这话当营养品吸收，保证下次脱胎换骨！'],
                [/[，,]谢谢/, '，我现在的开心程度堪比发工资日～'],
                [/感谢您的?指正/, '谢谢免费指导，我这就把批评当补品吃！'],
                [/我理解你的?感受/, '来，咱们先吐槽五分钟，然后一起想办法～'],
                [/建议你?/, '我有个不成熟的小建议：'],
                [/我会认真?反思/, '我这就启动反思模式，保证下次升级换代！'],
                [/请注意?休息/, '你不是在加班，你是在超长待机！该充电了～'],
                [/不辜负/, '保证不辜负，下次让您眼前一亮！'],
                [/全力以赴/, '我这就启动多线程模式！不过CPU可能发热，需要资源支持～'],
                [/及时同步/, '保证比快递还准时更新～'],
                [/我会尽力/, '我这就化身打工人plus版！'],
            ],
            gentle: [
                [/！/g, '。'],
                [/你不需要一个人扛/, '你可以不用一个人扛，我在这里'],
                [/建议你/, '也许你可以试试'],
                [/请注意/, '希望你能注意'],
                [/不要说/, '也许可以不说'],
                [/必须/, '可以试着'],
                [/确保/, '尽量做到'],
                [/立刻|马上|立即/, '可以的话尽快'],
            ],
            direct: [
                [/同时想和您确认一下/, '请确认：'],
                [/我初步的想法是按/, '按'],
                [/过程中有重要节点我会及时同步/, '关键节点同步'],
                [/感谢领导的信任/, '收到'],
                [/我会全力以赴/, '我会完成'],
                [/想和您探讨一下/, '建议调整：'],
                [/我理解你的感受.*?。/, ''],
                [/希望对你有帮助。?$/, ''],
                [/不辜负您的期望/, ''],
            ],
            witty: [
                [/我会继续努力/, '努力这种事，我从来不缺，缺的是舞台～'],
                [/谢谢领导的?认可/, '领导一夸，我干劲直接翻倍！接下来保证更拼～'],
                [/我理解你的?感受/, '感同身受这种事，我可是专业的～'],
                [/建议你?/, '给你支个招——'],
                [/请注意?休息/, '身体是1，其他都是0，1倒了全是0～'],
                [/全力以赴/, '全力以赴是我的标配，惊喜才是我的加分项！'],
                [/及时同步/, '同步进度这事，我比闹钟还准时～'],
                [/不辜负/, '不辜负是基本操作，超预期才是我的风格！'],
            ]
        };

        const applyTransforms = (text, rules) => {
            let result = text;
            for (const [pattern, replacement] of rules) {
                if (pattern.test(result)) {
                    result = result.replace(pattern, replacement);
                    break;
                }
            }
            return result;
        };

        let humorous = applyTransforms(baseReply, transforms.humorous);
        if (humorous === baseReply) {
            if (isWorkplace) {
                humorous = baseReply.replace(/[！!。]$/g, '') + '，保证比KPI还靠谱！';
            } else if (isRelationship) {
                humorous = baseReply.replace(/[！!。]$/g, '') + '～别太认真啦～';
            } else if (isSocial) {
                humorous = baseReply.replace(/[！!。]$/g, '') + '，场面话嘛，我熟！';
            } else {
                humorous = baseReply.replace(/[！!。]$/g, '') + '嘛，别太严肃～';
            }
        }

        let gentle = applyTransforms(baseReply, transforms.gentle);
        if (gentle === baseReply) {
            gentle = baseReply.replace(/[！!]/g, '。');
            if (!/[。？?]$/.test(gentle)) gentle += '。';
            gentle += '希望对你有帮助。';
        }

        let direct = applyTransforms(baseReply, transforms.direct);
        if (direct === baseReply) {
            const sentences = baseReply.split(/[，,。.！!？?；;]/g).filter(s => s.trim());
            direct = sentences[0] || baseReply;
        }
        direct = direct.replace(/希望对你有帮助。?$/, '').trim();
        if (!/[。！!？?]$/.test(direct)) direct += '。';

        let witty = applyTransforms(baseReply, transforms.witty);
        if (witty === baseReply) {
            if (isWorkplace) {
                witty = baseReply.replace(/[！!。]$/g, '') + '——这就是我的职场生存法则！';
            } else if (isRelationship) {
                witty = baseReply.replace(/[！!。]$/g, '') + '，感情这课我可是满分毕业～';
            } else if (isSocial) {
                witty = baseReply.replace(/[！!。]$/g, '') + '，社交达人就是我！';
            } else {
                witty = baseReply.replace(/[！!。]$/g, '') + '——这就是我的秘诀！';
            }
        }

        return { humorous, gentle, direct, witty };
    },

    getRandomStyle() {
        const styles = Object.keys(this.styleMap);
        return styles[Math.floor(Math.random() * styles.length)];
    },

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    highlightKeywords(text, keywords) {
        if (!keywords || keywords.length === 0) return this.escapeHtml(text);
        const positions = [];
        for (const kw of keywords) {
            if (!kw || kw.length < 1) continue;
            const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                positions.push({ start: match.index, end: match.index + match[0].length });
            }
        }
        if (positions.length === 0) return this.escapeHtml(text);
        positions.sort((a, b) => b.start - a.start);
        const seen = new Set();
        const unique = positions.filter(p => {
            const key = p.start + '-' + p.end;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        let result = text;
        for (const pos of unique) {
            result = result.slice(0, pos.start) + '\x00HS\x00' + result.slice(pos.start, pos.end) + '\x00HE\x00' + result.slice(pos.end);
        }
        result = this.escapeHtml(result);
        result = result.replace(/\x00HS\x00/g, '<span class="highlight">').replace(/\x00HE\x00/g, '</span>');
        return result;
    }
};
