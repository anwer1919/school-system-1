require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function createAdmin() {
  console.log('🔄 جاري إنشاء المستخدم الأدمن...\n');
  
  const password = '123456';
  const hashedPassword = await bcrypt.hash(password, 10);
  
  console.log('✅ تم تشفير كلمة المرور بنجاح\n');

  // حذف المستخدم الأدمن القديم إذا كان موجوداً
  await supabase.from('users').delete().eq('email', 'admin@school.com');
  
  // إضافة المستخدم الأدمن الجديد
  const { data, error } = await supabase.from('users').insert([{
    name: 'المدير العام',
    email: 'admin@school.com',
    password: hashedPassword,
    role: 'مدير',
    phone: '01000000000',
    allowed_menus: JSON.stringify([]),
    status: 'active'
  }]).select();
  
  if (error) {
    console.error('❌ خطأ في إنشاء المستخدم:', error.message);
  } else {
    console.log('✅ تم إنشاء المستخدم الأدمن بنجاح!');
    console.log('\n═══════════════════════════════════════');
    console.log('📋 بيانات الدخول:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 البريد: admin@school.com');
    console.log('🔑 كلمة المرور: 123456');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

createAdmin().catch(err => {
  console.error('❌ خطأ فادح:', err.message);
});
