require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// الصفحات
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/public/login.html'));

// ======== تسجيل الدخول ========
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: users, error } = await supabase.from('users').select('*').eq('email', email).limit(1);
    if (error || !users || users.length === 0) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }
    const user = users[0];
    
    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'حسابك موقوف، تواصل مع الإدارة' });
    }
    
    // التحقق من كلمة المرور (يقبل 123456 مباشرة أو كلمة المرور المشفرة)
    let isMatch = false;
    if (password === '123456') {
      isMatch = true; // كلمة مرور احتياطية مضمونة
    } else {
      try { 
        isMatch = await bcrypt.compare(password, user.password); 
      } catch (e) { 
        isMatch = false; 
      }
    }
    
    if (!isMatch) return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
    
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        role: user.role, 
        email: user.email,
        allowed_menus: JSON.parse(user.allowed_menus || '[]')
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});
    
    let isMatch = false;
    try { isMatch = await bcrypt.compare(password, user.password); } 
    catch (e) { isMatch = (password === '123456'); }
    if (!isMatch) return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
    
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        role: user.role, 
        email: user.email,
        allowed_menus: JSON.parse(user.allowed_menus || '[]')
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// ======== إدارة المستخدمين ========
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('id, name, email, role, phone, allowed_menus, status, created_at').order('id', { ascending: false });
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, count: data?.length || 0, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password, role, phone, allowed_menus } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'الاسم والبريد وكلمة المرور مطلوبة' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userData = {
      name,
      email,
      password: hashedPassword,
      role: role || 'مخصص',
      phone: phone || null,
      allowed_menus: JSON.stringify(allowed_menus || []),
      status: 'active'
    };

    const { data, error } = await supabase.from('users').insert([userData]).select();
    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل' });
      }
      return res.status(500).json({ success: false, message: error.message });
    }
    
    res.json({ success: true, data: data[0], message: '✅ تمت إضافة المستخدم بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email, password, role, phone, allowed_menus, status } = req.body;
    const updateData = { name, email, role, phone, status };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    if (allowed_menus) {
      updateData.allowed_menus = JSON.stringify(allowed_menus);
    }

    const { data, error } = await supabase.from('users').update(updateData).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ success: false, message: error.message });
    
    res.json({ success: true, message: '✅ تم تعديل المستخدم بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, message: '🗑️ تم حذف المستخدم بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======== كل الجداول ========
const tables = ['students', 'teachers', 'employees', 'parents', 'subjects', 'exams', 'grades', 'schedules', 'attendance', 'fees', 'revenue', 'expenses', 'transport', 'clinic', 'library', 'inventory', 'calendar_events', 'audit_log', 'school_info'];

// GET
tables.forEach(table => {
  app.get(`/api/${table}`, async (req, res) => {
    try {
      const { data, error } = await supabase.from(table).select('*').order('id', { ascending: false });
      if (error) {
        console.error(`❌ GET ${table}:`, error.message);
        return res.status(500).json({ success: false, message: error.message });
      }
      if (table === 'school_info') {
        res.json({ success: true, data: data?.[0] || null });
      } else {
        res.json({ success: true, count: data.length, data: data });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

// POST
tables.forEach(table => {
  app.post(`/api/${table}`, async (req, res) => {
    try {
      const { data, error } = await supabase.from(table).insert([req.body]).select();
      if (error) {
        console.error(`❌ POST ${table}:`, error.message);
        return res.status(500).json({ success: false, message: error.message });
      }
      res.json({ success: true, data: data[0], message: '✅ تمت الإضافة بنجاح' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

// PUT
tables.forEach(table => {
  app.put(`/api/${table}/:id`, async (req, res) => {
    try {
      const { data, error } = await supabase.from(table).update(req.body).eq('id', req.params.id).select();
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, message: '✅ تم التعديل' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

// DELETE
tables.forEach(table => {
  app.delete(`/api/${table}/:id`, async (req, res) => {
    try {
      const { error } = await supabase.from(table).delete().eq('id', req.params.id);
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, message: '🗑️ تم الحذف' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

// ======== الشهادات ========
app.get('/certificate/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) return res.status(400).send('معرف الطالب غير صحيح');
    
    const { data: schoolData } = await supabase.from('school_info').select('*').limit(1);
    const school = schoolData?.[0] || { name: 'مدرسة النور', logo: '🏫', academic_year: '2026-2027' };

    const { data: students } = await supabase.from('students').select('*').eq('id', studentId).limit(1);
    if (!students || students.length === 0) return res.status(404).send('الطالب غير موجود');
    
    const student = students[0];
    const { data: gradesData } = await supabase.from('grades').select('*').eq('student_name', student.name);
    
    let ts = 0, tm = 0;
    (gradesData || []).forEach(g => { ts += Number(g.score) || 0; tm += Number(g.max_score) || 0; });
    
    const p = tm > 0 ? ((ts / tm) * 100).toFixed(2) : 0;
    const g = p >= 90 ? 'ممتاز' : p >= 80 ? 'جيد جداً' : p >= 70 ? 'جيد' : p >= 60 ? 'مقبول' : 'ضعيف';
    const gColor = p >= 90 ? '#10b981' : p >= 80 ? '#3b82f6' : p >= 70 ? '#f59e0b' : '#ef4444';
    const today = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    res.send(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>شهادة - ${student.name}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"><style>body{font-family:'Cairo',sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);padding:40px 20px}.cert{max-width:850px;margin:auto;background:#fffef5;padding:50px;border:20px double #d4af37;border-radius:15px}.header{text-align:center;border-bottom:3px double #d4af37;padding-bottom:20px;margin-bottom:30px}.header h1{color:#1e40af;font-size:38px}.title{text-align:center;font-size:42px;color:#d4af37;margin:30px 0;font-weight:700}.student-name{display:inline-block;font-size:34px;color:#1e40af;font-weight:700;border-bottom:3px solid #d4af37;padding:5px 40px 10px}table{width:100%;border-collapse:collapse;margin:30px 0}th{background:#1e40af;color:white;padding:14px}td{padding:12px;border:1px solid #ddd;text-align:center}.total-row{background:#fef3c7;font-weight:700;border-top:3px solid #d4af37}.grade-badge{padding:8px 25px;background:${gColor};color:white;font-size:22px;font-weight:700;border-radius:30px}.print-btn{display:block;margin:25px auto;padding:15px 50px;background:#1e40af;color:white;border:none;border-radius:30px;font-size:18px;cursor:pointer}@media print{body{background:white;padding:0}.cert{box-shadow:none}.print-btn{display:none}}</style></head><body><div class="cert"><div class="header"><div style="font-size:70px">${school.logo||'🏫'}</div><h1>${school.name}</h1><div style="color:#d4af37;font-size:18px">العام الدراسي: ${school.academic_year}</div></div><div class="title">✨ شهادة تقدير ✨</div><div style="text-align:center"><p style="font-size:20px">تشهد إدارة المدرسة بأن الطالب/ة</p><div class="student-name">${student.name}</div><p style="font-size:18px;margin-top:15px">بالصف <strong>${student.grade}</strong> - شعبة <strong>${student.section}</strong></p></div>${gradesData&&gradesData.length>0?`<table><thead><tr><th>م</th><th>المادة</th><th>درجة الطالب/ة</th><th>المجموع الكلي</th><th>النسبة</th></tr></thead><tbody>${gradesData.map((g,i)=>`<tr><td>${i+1}</td><td>${g.subject}</td><td>${g.score}</td><td>${g.max_score}</td><td>${((g.score/g.max_score)*100).toFixed(1)}%</td></tr>`).join('')}<tr class="total-row"><td colspan="2" style="text-align:right;padding-right:20px">المجموع الكلي</td><td>${ts}</td><td>${tm}</td><td>${p}%</td></tr></tbody></table><div style="background:#fef3c7;padding:20px;border-radius:15px;margin:20px 0;border:2px solid #d4af37;display:flex;justify-content:space-around"><div style="text-align:center"><div style="font-size:16px;color:#92400e">النسبة</div><div style="font-size:32px;color:#1e40af;font-weight:700">${p}%</div></div><div style="text-align:center"><div style="font-size:16px;color:#92400e">التقدير</div><div class="grade-badge">${g}</div></div></div>`:'<p style="text-align:center;color:#999;padding:20px">لا توجد درجات مسجلة</p>'}<div style="display:flex;justify-content:space-between;margin-top:60px;padding-top:20px;border-top:2px solid #d4af37"><div style="text-align:center;flex:1"><div style="color:#666;margin-bottom:40px">التاريخ</div><div style="border-top:2px solid #333;width:180px;margin:0 auto"></div><div style="margin-top:8px">${today}</div></div><div style="text-align:center;flex:1"><div style="color:#666;margin-bottom:40px">توقيع المدير</div><div style="border-top:2px solid #333;width:180px;margin:0 auto"></div></div></div></div><button class="print-btn" onclick="window.print()">🖨️ طباعة</button></body></html>`);
  } catch (err) {
    res.status(500).send('خطأ في الخادم: ' + err.message);
  }
});

// ======== التقارير ========
function makeReport(title, headers, rows, extra = '') {
  const rowsHtml = rows && rows.length > 0 ? rows : `<tr><td colspan="${headers.length}" style="text-align:center;padding:20px;color:#999">لا توجد بيانات</td></tr>`;
  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:40px;background:#f5f5f5}h1{text-align:center;color:#1e40af}table{width:100%;border-collapse:collapse;margin-top:20px;background:white}th{background:#1e40af;color:white;padding:12px}td{padding:10px;border:1px solid #ddd;text-align:center}tr:nth-child(even){background:#f9f9f9}.summary{background:#f0f9ff;padding:20px;border-radius:10px;text-align:center;margin:20px 0;border:2px solid #3b82f6}.pbtn{display:block;margin:30px auto;padding:12px 40px;background:#1e40af;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px}@media print{.pbtn{display:none}body{background:white}}</style></head><body><h1>${title}</h1><p style="text-align:center">تاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>${extra}<table><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>${rowsHtml}</table><button class="pbtn" onclick="window.print()">🖨️ طباعة</button></body></html>`;
}

app.get('/api/reports/students', async (req, res) => {
  const { data } = await supabase.from('students').select('*');
  const r = (data || []).map(s => `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.grade||'-'}</td><td>${s.section||'-'}</td><td>${s.status||'-'}</td></tr>`).join('');
  res.send(makeReport('📄 تقرير الطلاب', ['الرقم','الاسم','الصف','الشعبة','الحالة'], r));
});

app.get('/api/reports/teachers', async (req, res) => {
  const { data } = await supabase.from('teachers').select('*');
  const r = (data || []).map(t => `<tr><td>${t.id}</td><td>${t.name}</td><td>${t.subject||'-'}</td><td>${t.phone||'-'}</td><td>${t.salary||0} جنيه</td></tr>`).join('');
  res.send(makeReport('👨‍🏫 تقرير المعلمين', ['الرقم','الاسم','المادة','الهاتف','الراتب'], r));
});

app.get('/api/reports/employees', async (req, res) => {
  const { data } = await supabase.from('employees').select('*');
  const r = (data || []).map(e => `<tr><td>${e.id}</td><td>${e.name}</td><td>${e.role||'-'}</td><td>${e.phone||'-'}</td><td>${e.salary||0} جنيه</td></tr>`).join('');
  res.send(makeReport('👔 تقرير الموظفين', ['الرقم','الاسم','الوظيفة','الهاتف','الراتب'], r));
});

app.get('/api/reports/attendance', async (req, res) => {
  const { data } = await supabase.from('attendance').select('*');
  const r = (data || []).map(a => `<tr><td>${a.student_name}</td><td>${a.date}</td><td>${a.status==='present'?'حاضر':a.status==='absent'?'غائب':'متأخر'}</td></tr>`).join('');
  res.send(makeReport('📅 تقرير الحضور', ['الطالب','التاريخ','الحالة'], r));
});

app.get('/api/reports/grades', async (req, res) => {
  const { data } = await supabase.from('grades').select('*');
  const r = (data || []).map(g => {
    const p = ((g.score/g.max_score)*100).toFixed(1);
    const gr = p>=90?'ممتاز':p>=80?'جيد جداً':p>=70?'جيد':p>=60?'مقبول':'ضعيف';
    return `<tr><td>${g.student_name}</td><td>${g.subject}</td><td>${g.score}/${g.max_score}</td><td>${p}%</td><td>${gr}</td></tr>`;
  }).join('');
  res.send(makeReport('🎯 كشوف الدرجات', ['الطالب','المادة','الدرجة','النسبة','التقدير'], r));
});

app.get('/api/reports/fees', async (req, res) => {
  const { data } = await supabase.from('fees').select('*');
  let total=0,paid=0;
  (data || []).forEach(f=>{total+=Number(f.amount)||0;if(f.status==='paid')paid+=Number(f.amount)||0;});
  const r = (data || []).map(f => `<tr><td>${f.student_name}</td><td>${f.amount} جنيه</td><td>${f.type||'-'}</td><td>${f.status==='paid'?'مدفوع':'غير مدفوع'}</td></tr>`).join('');
  res.send(makeReport('💰 التقرير المالي', ['الطالب','المبلغ','النوع','الحالة'], r, `<div class="summary"><b>الإجمالي: ${total} | المدفوع: ${paid} | المتبقي: ${total-paid}</b></div>`));
});

app.get('/api/reports/financial', async (req, res) => {
  const { data: rev } = await supabase.from('revenue').select('*');
  const { data: exp } = await supabase.from('expenses').select('*');
  let tr=0,te=0;
  (rev || []).forEach(r=>tr+=Number(r.amount)||0);
  (exp || []).forEach(e=>te+=Number(e.amount)||0);
  const rr = (rev || []).map(r=>`<tr><td>${r.source}</td><td>${r.amount} جنيه</td><td>${r.date}</td></tr>`).join('');
  const er = (exp || []).map(e=>`<tr><td>${e.category}</td><td>${e.amount} جنيه</td><td>${e.date}</td></tr>`).join('');
  res.send(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>التقرير المالي</title><style>body{font-family:Arial;padding:40px}h1,h2{text-align:center;color:#1e40af}table{width:100%;border-collapse:collapse;margin:10px auto;background:white}th{background:#1e40af;color:white;padding:10px}td{padding:8px;border:1px solid #ddd;text-align:center}.summary{background:#f0f9ff;padding:15px;border-radius:10px;text-align:center;margin:20px auto;max-width:600px}.pbtn{display:block;margin:20px auto;padding:10px 30px;background:#1e40af;color:white;border:none;border-radius:5px;cursor:pointer}@media print{.pbtn{display:none}}</style></head><body><h1>💰 التقرير المالي الشامل</h1><div class="summary"><b>الإيرادات: ${tr} | المصروفات: ${te} | الصافي: ${tr-te}</b></div><h2>📈 الإيرادات</h2><table><tr><th>المصدر</th><th>المبلغ</th><th>التاريخ</th></tr>${rr||'<tr><td colspan="3">لا توجد</td></tr>'}</table><h2>📉 المصروفات</h2><table><tr><th>البند</th><th>المبلغ</th><th>التاريخ</th></tr>${er||'<tr><td colspan="3">لا توجد</td></tr>'}</table><button class="pbtn" onclick="window.print()">🖨️ طباعة</button></body></html>`);
});

app.get('/api/reports/transport', async (req, res) => {
  const { data } = await supabase.from('transport').select('*');
  const r = (data || []).map(t => `<tr><td>${t.bus_name}</td><td>${t.route}</td><td>${t.driver||'-'}</td><td>${t.students_count||0}/${t.capacity||0}</td></tr>`).join('');
  res.send(makeReport('🚌 تقرير النقل', ['الباص','المسار','السائق','الطلاب/السعة'], r));
});

app.get('/api/reports/schedules', async (req, res) => {
  const { data } = await supabase.from('schedules').select('*');
  const r = (data || []).map(s => `<tr><td>${s.day}</td><td>${s.period}</td><td>${s.subject}</td><td>${s.teacher||'-'}</td><td>${s.room||'-'}</td></tr>`).join('');
  res.send(makeReport('🕐 جدول الحصص', ['اليوم','الحصة','المادة','المعلم','القاعة'], r));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`🚀 النظام يعمل على المنفذ ${PORT}`);
  console.log(`═══════════════════════════════════════\n`);
});
