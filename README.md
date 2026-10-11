# kaisei · Personal Space

> 七転び八起き。
>
> 生则日勤，死则永息。

一个使用原生 HTML、CSS 与 JavaScript 制作的响应式个人网站。

## 项目位置

这是网站的本地开发目录，同时连接到 GitHub Pages 仓库：

```text
/Users/yizho/Documents/ChatGPT/kaisei-jp.github.io
```

主要页面：

- `index.html`：个人成长主页
- `plan.html`：赴日计划 / 里程碑页面
- `admin.html`：不在公开导航中显示的管理员登录入口
- `styles.css`：主页与共用样式
- `plan.css`：赴日计划页面样式
- `script.js`：导航、滚动与渐入动画

## 本地预览

```bash
cd "/Users/yizho/Documents/ChatGPT/kaisei-jp.github.io"
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

公开的赴日计划页只展示已上传的成果。管理员通过独立入口登录后，才能在里程碑卡片上看到上传与删除按钮。账号密码是 Supabase Authentication 中的用户账号，并非 GitHub 或 Supabase Dashboard 的登录密码。

首次启用或从旧版升级时：

1. 在 Supabase Dashboard → Authentication → Users 创建或邀请自己的用户账号，设置登录密码。若账号尚不存在，先完成这一步。
2. 在 SQL Editor 完整执行本目录的 `supabase-schema.sql`。脚本会创建管理员名单，并将数据库和 Storage 的写入权限收紧为管理员专用。
3. 在 SQL Editor 单独执行下面的语句，把 `你的登录邮箱` 换成第 1 步的邮箱：

   ```sql
   insert into public.site_admins (user_id)
   select id from auth.users where email = '你的登录邮箱'
   on conflict (user_id) do nothing;
   ```

   可用 `select count(*) from public.site_admins;` 确认结果为 `1`。不要把你的密码写进 SQL、网页代码或 Git 仓库。
4. 在 Authentication 设置中关闭「Allow new users to sign up」。管理员名单仍由数据库策略单独校验；关闭注册可避免无关账号产生。
5. 在 Project Settings → API 中复制 Project URL 和 publishable/anon key，填写到 `supabase-config.js`（当前项目已完成）：

   ```js
   window.SUPABASE_CONFIG = Object.freeze({
     url: "https://你的项目.supabase.co",
     anonKey: "你的 publishable/anon key",
     bucket: "milestone-proofs",
     maxFileSize: 10 * 1024 * 1024,
   });
   ```

6. 如使用邮件邀请或重置密码，在 Authentication 的 URL 配置中加入：
   - `http://127.0.0.1:8000/plan.html`
   - `https://kaisei-jp.github.io/plan.html`
   - `https://kaisei-jp.github.io/admin.html`
7. 打开 `https://kaisei-jp.github.io/admin.html` 登录，然后点击「打开里程碑，上传图片」。

管理员页面没有出现在网站导航中，但它的 URL 本身是公开可访问的；真正限制上传和删除的是 Supabase Authentication、`site_admins` 名单与 RLS 策略。浏览器端只能使用 publishable/anon key，不能使用 secret/service_role key。图片 bucket 公开读取，适合上传愿意公开展示的成果截图，不要上传身份证件、护照或其他私人文件。
