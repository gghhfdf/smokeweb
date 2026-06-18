# Cabinet Ops 项目要求

## 自动化操作要求

- GitHub 相关操作优先使用 GitHub 插件或可验证的本地 Git/GitHub CLI 流程，包括仓库同步、GitHub Pages 部署、Actions 状态检查、部署产物检查和线上 URL 验证。
- Supabase 相关操作优先使用 Supabase 插件，包括表结构审查、RPC 审查、Advisors 检查、数据计数、迁移执行和云端状态验证。
- 不要求用户手动完成 GitHub 或 Supabase 操作，除非插件不可用、账号授权失效，或外部服务明确要求用户确认。
- 每次云端或部署改动后都需要完成：本地 `npm run lint`、`npm run build`、GitHub Actions 检查、Pages 线上页面检查、Supabase 数据与 Advisors 复查。

## 安全与密钥

- 前端和 GitHub Pages 只能使用 Supabase anon 或 publishable key。
- 禁止把 Supabase `service_role`、secret key、数据库密码或任何私密令牌写入仓库、前端代码、README、GitHub Pages 环境变量或浏览器端配置。
- 当前站点采用静态 GitHub Pages + Supabase RPC + 自定义管理员 session。该方案用于轻量展示与单管理员运营，不等同于完整服务端安全认证。
- Supabase 表不得直接授予 `anon` 或 `authenticated` 表访问权限；公开 RPC 必须继续检查管理员 session token。

## 产品范围

- 网站只做成人烟草商品展示和商品资料维护。
- 不实现购物车、下单、支付、配送、会员购买或任何交易流程入口。
- 必须保留：年龄确认、商品展示页、管理员登录、商品管理、设置页、云端数据导入导出、商品图片上传与压缩。

## UI/UX 标准

- 视觉方向为明色调高端展示与运营后台一体化：暖白、黑绿、香槟金、鼠尾草绿或石墨白主题。
- 页面、抽屉、弹窗、Toast、商品卡、按钮、开关和筛选控件需要有细致但不拖慢操作的动效，并尊重 `prefers-reduced-motion`。
- 手机、平板、桌面都必须可展示和可管理；禁止文字溢出、按钮挤压、表格不可用和图片变形。
- 商品图必须来自上传图片，禁止用粗糙 CSS 线条图替代真实商品图。

## 云端数据与图片

- 商品、设置、管理员、会话、图片、导入导出和清空流程均走 Supabase 云端。
- 仅年龄确认状态和当前设备的云端 session token 保留在本设备。
- 商品图片上传前必须在浏览器端自动压缩，默认目标 `25KB`，硬上限 `30KB`。
- Supabase 后端必须拒绝超大图片 data URL；当前 `cabinet_images.data_url` 硬上限为 `120KB`，用于兜底防止绕过前端上传大图。
- 图片压缩结果需要在 UI 中显示原始大小、压缩后大小、分辨率、格式和压缩率。
- 若图片无法在最低质量与最低尺寸内压缩到硬上限，必须拒绝上传并提示用户换图或裁切。
