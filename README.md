# IseiKa · Personal Space

> 生则日勤，死则永息。

一个使用原生 HTML、CSS 与 JavaScript 制作的响应式个人网站。

## 项目位置

这是网站的本地开发目录，同时连接到 GitHub Pages 仓库：

```text
/Users/yizho/Documents/ChatGPT/个人网页
```

主要页面：

- `index.html`：个人研究主页
- `plan.html`：赴日计划 / 里程碑页面
- `styles.css`：主页与共用样式
- `plan.css`：赴日计划页面样式
- `script.js`：导航、滚动与渐入动画

## 本地预览

```bash
cd "/Users/yizho/Documents/ChatGPT/个人网页"
python3 -m http.server 8000 --bind 127.0.0.1
```

然后访问：

- `http://localhost:8000/`
- `http://localhost:8000/plan.html`

macOS 用户也可以直接双击 `start-local.command` 启动本地预览。

## 发布更新

修改并确认本地效果后：

```bash
git add .
git commit -m "Describe your change"
git push origin main
```

推送后，GitHub Pages 会自动构建并更新公网页面。
