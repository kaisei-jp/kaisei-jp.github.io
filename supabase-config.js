/*
 * Supabase 的浏览器端配置。
 *
 * 这里只能填写 Project URL 和 publishable/anon key，不能填写 service_role key。
 * 这两个值会出现在网页源代码中，真正的安全边界由 Supabase 的 RLS 策略保证。
 */
window.SUPABASE_CONFIG = Object.freeze({
  url: "https://fmdvswiotkrdglsilgrc.supabase.co",
  anonKey: "sb_publishable_ZQ0rDJOsKGcJlqey1HtK6w_MHpsbmam",
  bucket: "milestone-proofs",
  maxFileSize: 10 * 1024 * 1024,
});
