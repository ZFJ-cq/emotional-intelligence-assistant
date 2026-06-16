## 1. 架构设计

纯前端单文件架构，所有代码（HTML+CSS+JavaScript）集成在一个 HTML 文件中，通过 CDN 引入 Tailwind CSS，无需任何构建工具或后端服务。

```mermaid
flowchart TD
    "浏览器" --> "index.html（单文件）"
    "index.html（单文件）" --> "HTML结构层"
    "index.html（单文件）" --> "CSS样式层（Tailwind CDN + 自定义CSS）"
    "index.html（单文件）" --> "JavaScript逻辑层"
    "JavaScript逻辑层" --> "游戏状态管理"
    "JavaScript逻辑层" --> "题目生成引擎"
    "JavaScript逻辑层" --> "UI渲染与动画"
    "JavaScript逻辑层" --> "关卡与流程控制"
```

## 2. 技术说明
- 前端：纯 HTML5 + CSS3 + JavaScript（ES6+）
- 样式框架：Tailwind CSS（CDN引入）
- 字体：Google Fonts（ZCOOL KuaiLe + Noto Sans SC）
- 构建工具：无（直接浏览器运行）
- 后端：无
- 数据库：无（游戏状态存储在内存中）

## 3. 路由定义
| 路由 | 用途 |
|------|------|
| / | 游戏入口，单页面应用，通过JS控制页面状态切换 |

## 4. 游戏状态管理

使用 JavaScript 对象管理游戏状态：

```javascript
const gameState = {
  screen: 'start',       // start | game | levelTransition | result
  currentLevel: 0,       // 0-4 对应5个关卡
  score: 0,              // 总得分
  lives: 3,              // 剩余生命值
  correctInLevel: 0,     // 当前关卡答对题数
  questionsPerLevel: 5,  // 每关需要答对5题
  currentQuestion: null,  // 当前题目
  feedback: null,        // 反馈状态 correct | wrong
}
```

## 5. 关卡配置

```javascript
const levels = [
  { name: '白雪公主', emoji: '👸🍎', type: 'add_sub_20', color: '#E74C3C', bg: '#FADBD8' },
  { name: '小红帽', emoji: '🐺👧', type: 'add_sub_50', color: '#C0392B', bg: '#F5B7B1' },
  { name: '灰姑娘', emoji: '👠✨', type: 'add_sub_100', color: '#2980B9', bg: '#D6EAF8' },
  { name: '冰雪奇缘', emoji: '❄️⛄', type: 'multiply', color: '#5DADE2', bg: '#D4E6F1' },
  { name: '爱丽丝梦游仙境', emoji: '🐇🎩', type: 'divide_mixed', color: '#8E44AD', bg: '#E8DAEF' },
]
```

## 6. 题目生成引擎

根据关卡类型生成不同难度的算术题：

| 关卡类型 | 生成规则 |
|----------|----------|
| add_sub_20 | 两个1-20的数加减，结果非负 |
| add_sub_50 | 两个1-50的数加减，结果非负 |
| add_sub_100 | 两个1-100的数加减，结果非负 |
| multiply | 乘法表范围：1-9 × 1-9 |
| divide_mixed | 整除除法 + 简单混合运算 |

## 7. 动画系统

使用 CSS Keyframes + JavaScript 控制动画：
- 页面切换：淡入淡出 + 缩放
- 正确反馈：绿色脉冲 + 星星飞散粒子
- 错误反馈：红色抖动 + 心形破碎
- 关卡解锁：故事书翻页效果
- 胜利弹窗：彩色纸屑粒子效果
- 背景：缓慢飘动的星星/雪花粒子
