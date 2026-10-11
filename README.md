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

## Supabase 云端记录配置

赴日计划页已经接入登录、图片上传、云端记录和多设备同步。第一次使用时需要配置自己的 Supabase 项目：

1. 在 Supabase 创建一个项目。
2. 打开 SQL Editor，执行本目录的 `supabase-schema.sql`。
3. 在 Authentication → Users 中创建你的账户，并关闭公开注册（这样只有你本人可以上传和删除记录）。
4. 在 Project Settings → API 中复制 Project URL 和 publishable/anon key，填写到 `supabase-config.js`：

   ```js
   window.SUPABASE_CONFIG = Object.freeze({
     url: "https://你的项目.supabase.co",
     anonKey: "你的 publishable/anon key",
     bucket: "milestone-proofs",
     maxFileSize: 10 * 1024 * 1024,
   });
   ```

5. 在 Authentication 的 URL 配置中加入：
   - `http://127.0.0.1:8000/plan.html`
   - `https://2206113885.github.io/plan.html`
6. 提交并推送代码，打开赴日计划页登录后即可上传图片。

浏览器端只能使用 publishable/anon key，不能使用 service_role key。里程碑图片所在的 bucket 是公开读取的，因此适合上传证书、成果截图等公开内容，不要上传身份证件、护照或其他私人文件。
