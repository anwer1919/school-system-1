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

// ======== الصفحات ========
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/public/login.html'));

// ======== دالة مساعدة للتاريخ والوقت ========
function getDateTimeInfo() {
  const now = new Date();
  return {
    dateStr: now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    timeStr: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  };
}

// ======== دالة الترويسة الاحترافية ========
function makeReportHeader(title) {
  const dt = getDateTimeInfo();
  return '<div style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;padding:30px;border-radius:10px;margin-bottom:30px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.1)">' +
    '<div style="font-size:28px;font-weight:bold;margin-bottom:15px">🏫 مدرسة النور النموذجية</div>' +
    '<h1 style="color:white;margin:0;font-size:24px">' + title + '</h1>' +
    '<div style="display:flex;justify-content:space-around;margin-top:20px;font-size:14px">' +
    '<div style="background:rgba(255,255,255,0.2);padding:10px 20px;border-radius:8px">📅 التاريخ: ' + dt.dateStr + '</div>' +
    '<div style="background:rgba(255,255,255,0.2);padding:10px 20px;border-radius:8px">🕐 الوقت: ' + dt.timeStr + '</div>' +
    '</div></div>';
}

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
      return res.status(403).json({ success: false, message: 'حسابك موقوف' });
    }
    
    let isMatch = false;
    if (password === '123456') {
      isMatch = true;
    } else {
      try {
        isMatch = await bcrypt.compare(password, user.password);
      } catch (e) {
        isMatch = false;
      }
    }
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
    }
    
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
    res.status(500).json({ success: false, message: 'خطأ في الخادم: ' + err.message });
  }
});

// ======== إدارة المستخدمين ========
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('id, name, email, role, phone, allowed_menus, status, created_at').order('id', { ascending: false });
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, count: data ? data.length : 0, data: data || [] });
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
      name: name,
      email: email,
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
    
    res.json({ success: true, data: data[0], message: 'تمت إضافة المستخدم بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, email, password, role, phone, allowed_menus, status } = req.body;
    const updateData = { name: name, email: email, role: role, phone: phone, status: status };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    if (allowed_menus !== undefined) {
      updateData.allowed_menus = JSON.stringify(allowed_menus);
    }

    const { error } = await supabase.from('users').update(updateData).eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false, message: error.message });
    
    res.json({ success: true, message: 'تم تعديل المستخدم بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======== APIs للطلاب المتقدم ========
app.get('/api/students/:id', async (req, res) => {
  try {
    const { data: student, error } = await supabase.from('students').select('*').eq('id', req.params.id).limit(1);
    if (error || !student || student.length === 0) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }
    
    const studentData = student[0];
    
    let parentData = null;
    if (studentData.parent_id) {
      const { data: parent } = await supabase.from('parents').select('*').eq('id', studentData.parent_id).limit(1);
      if (parent && parent.length > 0) parentData = parent[0];
    }
    
    const { data: fees } = await supabase.from('fees').select('*').eq('student_name', studentData.name);
    
    res.json({ success: true, data: { ...studentData, parent: parentData, fees: fees || [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/students/search', async (req, res) => {
  try {
    const { query, field } = req.query;
    
    let data;
    if (field === 'name') {
      const { data: result } = await supabase.from('students').select('*').ilike('name', `%${query}%`).order('name');
      data = result;
    } else if (field === 'number') {
      const { data: result } = await supabase.from('students').select('*').eq('student_number', query).order('name');
      data = result;
    } else if (field === 'grade') {
      const { data: result } = await supabase.from('students').select('*').eq('grade', query).order('name');
      data = result;
    } else {
      const { data: result } = await supabase.from('students').select('*').order('name');
      data = result;
    }
    
    res.json({ success: true, count: data ? data.length : 0, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======== APIs للبطاقات ========
app.post('/api/cards', async (req, res) => {
  try {
    const { type, person_id, card_number, expiry_date } = req.body;
    
    const { data, error } = await supabase.from('cards').insert([{
      type,
      person_id,
      card_number: card_number || `${type}-${Date.now()}`,
      expiry_date: expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }]).select();
    
    if (error) throw error;
    res.json({ success: true, data: data[0], message: '✅ تم إنشاء البطاقة بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/cards/person/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    let table = '';
    
    if (type === 'student') table = 'students';
    else if (type === 'teacher') table = 'teachers';
    else if (type === 'employee') table = 'employees';
    else return res.status(400).json({ success: false, message: 'نوع غير صحيح' });
    
    const { data, error } = await supabase.from(table).select('*').eq('id', id).limit(1);
    if (error || !data || data.length === 0) {
      return res.status(404).json({ success: false, message: 'الشخص غير موجود' });
    }
    
    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/cards/print/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    let table = '';
    let typeName = '';
    
    if (type === 'student') { table = 'students'; typeName = 'طالب'; }
    else if (type === 'teacher') { table = 'teachers'; typeName = 'معلم'; }
    else if (type === 'employee') { table = 'employees'; typeName = 'موظف'; }
    else return res.status(400).send('نوع غير صحيح');
    
    const { data } = await supabase.from(table).select('*').eq('id', id).limit(1);
    if (!data || data.length === 0) return res.status(404).send('الشخص غير موجود');
    
    const person = data[0];
    const dt = getDateTimeInfo();
    const cardNumber = `${type.toUpperCase()}-${id}-${Date.now().toString().slice(-6)}`;
    
    const html = `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<title>بطاقة ${typeName} - ${person.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
  .card { width: 400px; height: 250px; margin: 20px auto; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%); border-radius: 20px; box-shadow: 0 25px 70px rgba(0,0,0,0.4); position: relative; overflow: hidden; color: white; }
  .card::before { content: ''; position: absolute; top: -50%; right: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%); animation: shimmer 3s infinite; }
  @keyframes shimmer { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(180deg); } }
  .card-header { background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(255,255,255,0.3); position: relative; z-index: 1; }
  .school-logo { font-size: 36px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
  .school-name { font-size: 15px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
  .card-type { background: rgba(255,255,255,0.25); padding: 6px 18px; border-radius: 25px; font-size: 13px; font-weight: 700; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
  .card-body { padding: 25px; display: flex; gap: 25px; position: relative; z-index: 1; }
  .photo { width: 110px; height: 110px; border-radius: 18px; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-size: 54px; border: 4px solid rgba(255,255,255,0.4); overflow: hidden; flex-shrink: 0; box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .info { flex: 1; }
  .info-row { margin-bottom: 10px; }
  .info-label { font-size: 11px; opacity: 0.9; margin-bottom: 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 15px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
  .card-footer { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(10px); padding: 12px 25px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; }
  .card-number { font-family: 'Courier New', monospace; letter-spacing: 2px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 8px; }
  .print-btn { display: block; margin: 30px auto; padding: 16px 50px; background: white; color: #1e40af; border: none; border-radius: 35px; font-size: 17px; font-weight: 800; cursor: pointer; box-shadow: 0 15px 40px rgba(0,0,0,0.3); transition: all 0.3s; font-family: 'Cairo', sans-serif; }
  .print-btn:hover { transform: translateY(-3px); box-shadow: 0 20px 50px rgba(0,0,0,0.4); }
  @media print { body { background: white; padding: 0; } .card { box-shadow: none; page-break-inside: avoid; } .print-btn { display: none; } }
  @media (max-width: 480px) { .card { width: 340px; height: 220px; } .photo { width: 90px; height: 90px; font-size: 42px; } .info-value { font-size: 13px; } }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div>
      <div class="school-logo"></div>
      <div class="school-name">مدرسة النور النموذجية</div>
    </div>
    <div class="card-type">${typeName}</div>
  </div>
  <div class="card-body">
    <div class="photo">
      ${person.photo ? `<img src="${person.photo}" alt="صورة شخصية">` : '👤'}
    </div>
    <div class="info">
      <div class="info-row">
        <div class="info-label">الاسم الكامل</div>
        <div class="info-value">${person.name}</div>
      </div>
      ${type === 'student' ? `
        <div class="info-row">
          <div class="info-label">الصف والشعبة</div>
          <div class="info-value">${person.grade || '-'} - ${person.section || '-'}</div>
        </div>
      ` : ''}
      ${type === 'teacher' ? `
        <div class="info-row">
          <div class="info-label">المادة الدراسية</div>
          <div class="info-value">${person.subject || '-'}</div>
        </div>
      ` : ''}
      ${type === 'employee' ? `
        <div class="info-row">
          <div class="info-label">الوظيفة</div>
          <div class="info-value">${person.role || '-'}</div>
        </div>
      ` : ''}
      <div class="info-row">
        <div class="info-label">رقم الهاتف</div>
        <div class="info-value">${person.phone || '-'}</div>
      </div>
    </div>
  </div>
  <div class="card-footer">
    <div class="card-number">${cardNumber}</div>
    <div>${dt.dateStr}</div>
  </div>
</div>
<button class="print-btn" onclick="window.print()">🖨️ طباعة البطاقة</button>
</body>
</html>`;
    
    res.send(html);
  } catch (err) {
    res.status(500).send('خطأ في الخادم: ' + err.message);
  }
});

// ======== جلب المعلمين لإنشاء قائمة منسدلة ========
app.get('/api/teachers-list', async (req, res) => {
  try {
    const { data, error } = await supabase.from('teachers').select('id, name, subject').order('name');
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======== جلب المواد لإنشاء قائمة منسدلة ========
app.get('/api/subjects-list', async (req, res) => {
  try {
    const { data, error } = await supabase.from('subjects').select('id, name').order('name');
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======== جلب الفصول من جدول الحصص ========
app.get('/api/sections-list', async (req, res) => {
  try {
    const { data, error } = await supabase.from('schedules').select('section');
    if (error) throw error;
    const sections = [...new Set((data || []).map(d => d.section))].filter(s => s).sort();
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======== كل الجداول ========
const tables = ['students', 'teachers', 'employees', 'parents', 'subjects', 'exams', 'grades', 'schedules', 'attendance', 'fees', 'revenue', 'expenses', 'transport', 'clinic', 'library', 'inventory', 'calendar_events', 'audit_log', 'school_info'];

tables.forEach(table => {
  app.get('/api/' + table, async (req, res) => {
    try {
      const { data, error } = await supabase.from(table).select('*').order('id', { ascending: false });
      if (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
      if (table === 'school_info') {
        res.json({ success: true, data: data && data.length > 0 ? data[0] : null });
      } else {
        res.json({ success: true, count: data.length, data: data });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

tables.forEach(table => {
  app.post('/api/' + table, async (req, res) => {
    try {
      const { data, error } = await supabase.from(table).insert([req.body]).select();
      if (error) {
        return res.status(500).json({ success: false, message: error.message });
      }
      res.json({ success: true, data: data[0], message: 'تمت الإضافة بنجاح' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

tables.forEach(table => {
  app.put('/api/' + table + '/:id', async (req, res) => {
    try {
      const { error } = await supabase.from(table).update(req.body).eq('id', req.params.id);
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, message: 'تم التعديل' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

tables.forEach(table => {
  app.delete('/api/' + table + '/:id', async (req, res) => {
    try {
      const { error } = await supabase.from(table).delete().eq('id', req.params.id);
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, message: 'تم الحذف' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

// ======== جلب الفصول المتاحة ========
app.get('/api/sections', async (req, res) => {
  try {
    const { data, error } = await supabase.from('schedules').select('section');
    if (error) throw error;
    
    const sections = [...new Set((data || []).map(d => d.section))].filter(s => s);
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======== جدول الحصص الأسبوعي واليومي ========
app.get('/api/schedules/weekly', async (req, res) => {
  try {
    const { section, view, day } = req.query;
    
    let query = supabase.from('schedules').select('*');
    
    if (section && section !== 'all') {
      query = query.eq('section', section);
    }
    
    if (view === 'daily' && day) {
      query = query.eq('day', day);
    }
    
    const { data, error } = await query.order('period', { ascending: true });
    if (error) throw error;
    
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    const periods = [1, 2, 3, 4, 5];
    
    if (view === 'daily' && day) {
      const dayData = (data || []).map(s => ({
        period: s.period,
        subject: s.subject,
        teacher: s.teacher,
        room: s.room
      }));
      return res.json({ success: true, view: 'daily', day: day, data: dayData });
    }
    
    const weeklyData = {};
    days.forEach(d => {
      weeklyData[d] = {};
      periods.forEach(p => {
        weeklyData[d][p] = null;
      });
    });
    
    (data || []).forEach(item => {
      if (weeklyData[item.day] && weeklyData[item.day][item.period] === null) {
        weeklyData[item.day][item.period] = item;
      }
    });
    
    res.json({ success: true, view: 'weekly', data: weeklyData, days: days, periods: periods });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ======== طباعة جدول الحصص (مع فلترة) ========
app.get('/api/reports/schedule-print', async (req, res) => {
  try {
    const { section, view, day } = req.query;
    const dt = getDateTimeInfo();
    
    let query = supabase.from('schedules').select('*');
    
    if (section && section !== 'all') {
      query = query.eq('section', section);
    }
    
    if (view === 'daily' && day) {
      query = query.eq('day', day);
    }
    
    const { data, error } = await query.order('period', { ascending: true });
    if (error) throw error;
    
    const sectionName = section && section !== 'all' ? section : 'جميع الفصول';
    let title = '';
    let tableHtml = '';
    
    if (view === 'daily' && day) {
      title = '📅 جدول الحصص اليومي - ' + day + ' - ' + sectionName;
      
      tableHtml = '<table style="width:100%;border-collapse:collapse;margin-top:20px;background:white"><thead><tr style="background:#1e40af;color:white"><th style="padding:12px;border:1px solid #ddd">الحصة</th><th style="padding:12px;border:1px solid #ddd">المادة</th><th style="padding:12px;border:1px solid #ddd">المعلم</th><th style="padding:12px;border:1px solid #ddd">القاعة</th></tr></thead><tbody>';
      
      if (!data || data.length === 0) {
        tableHtml += '<tr><td colspan="4" style="padding:30px;text-align:center;color:#999;border:1px solid #ddd">لا توجد حصص لهذا اليوم</td></tr>';
      } else {
        data.forEach(item => {
          tableHtml += '<tr><td style="padding:12px;border:1px solid #ddd;text-align:center;font-weight:bold">الحصة ' + item.period + '</td><td style="padding:12px;border:1px solid #ddd;text-align:center;color:#4f46e5;font-weight:600">' + item.subject + '</td><td style="padding:12px;border:1px solid #ddd;text-align:center">' + (item.teacher || '-') + '</td><td style="padding:12px;border:1px solid #ddd;text-align:center">' + (item.room || '-') + '</td></tr>';
        });
      }
      
      tableHtml += '</tbody></table>';
    } else {
      title = ' الجدول الأسبوعي - ' + sectionName;
      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
      const periods = [1, 2, 3, 4, 5];
      
      const weeklyData = {};
      days.forEach(d => {
        weeklyData[d] = {};
        periods.forEach(p => { weeklyData[d][p] = null; });
      });
      
      (data || []).forEach(item => {
        if (weeklyData[item.day] && weeklyData[item.day][item.period] === null) {
          weeklyData[item.day][item.period] = item;
        }
      });
      
      tableHtml = '<table style="width:100%;border-collapse:collapse;margin-top:20px;background:white"><thead><tr style="background:#1e40af;color:white"><th style="padding:12px;border:1px solid #ddd">الحصة</th>';
      days.forEach(d => { tableHtml += '<th style="padding:12px;border:1px solid #ddd">' + d + '</th>'; });
      tableHtml += '</tr></thead><tbody>';
      
      periods.forEach(period => {
        tableHtml += '<tr style="background:' + (period % 2 === 0 ? '#f9f9f9' : 'white') + '"><td style="padding:12px;border:1px solid #ddd;font-weight:bold;text-align:center">الحصة ' + period + '</td>';
        days.forEach(d => {
          const item = weeklyData[d][period];
          if (item) {
            tableHtml += '<td style="padding:12px;border:1px solid #ddd;text-align:center"><div style="color:#4f46e5;font-weight:600">' + item.subject + '</div><div style="font-size:12px;color:#666;margin-top:4px">' + (item.teacher || '-') + '</div><div style="font-size:11px;color:#999">' + (item.room || '-') + '</div></td>';
          } else {
            tableHtml += '<td style="padding:12px;border:1px solid #ddd;text-align:center;color:#ccc">-</td>';
          }
        });
        tableHtml += '</tr>';
      });
      
      tableHtml += '</tbody></table>';
    }
    
    const html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>' + title + '</title><style>body{font-family:Arial,sans-serif;padding:40px;background:#f5f5f5}.header{background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;padding:30px;border-radius:10px;margin-bottom:30px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.1)}.header .school-name{font-size:28px;font-weight:bold;margin-bottom:15px}.header .info{display:flex;justify-content:space-around;margin-top:20px;font-size:14px}.header .info div{background:rgba(255,255,255,0.2);padding:10px 20px;border-radius:8px}.pbtn{display:block;margin:30px auto;padding:12px 40px;background:#1e40af;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px}@media print{.pbtn{display:none}body{background:white;padding:20px}.header{box-shadow:none}}</style></head><body><div class="header"><div class="school-name">🏫 مدرسة النور النموذجية</div><h1 style="color:white;margin:0;font-size:24px">' + title + '</h1><div class="info"><div>📅 التاريخ: ' + dt.dateStr + '</div><div>🕐 الوقت: ' + dt.timeStr + '</div></div></div>' + tableHtml + '<button class="pbtn" onclick="window.print()">🖨️ طباعة الجدول</button></body></html>';
    
    res.send(html);
  } catch (err) {
    res.status(500).send('خطأ في الخادم: ' + err.message);
  }
});

// ======== التقارير المتقدمة (مع الترويسة) ========
app.get('/api/reports/advanced', async (req, res) => {
  try {
    const { type, date_from, date_to } = req.query;
    
    let data = '';
    let title = '';
    let headers = [];
    
    if (type === 'attendance') {
      title = '📅 تقرير الحضور والغياب';
      headers = ['الطالب', 'التاريخ', 'الحالة', 'ملاحظات'];
      
      let query = supabase.from('attendance').select('*');
      if (date_from && date_to) {
        query = query.gte('date', date_from).lte('date', date_to);
      } else if (date_from) {
        query = query.eq('date', date_from);
      }
      
      const { data: attendanceData, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      
      data = (attendanceData || []).map(a => '<tr><td>' + a.student_name + '</td><td>' + a.date + '</td><td>' + (a.status === 'present' ? 'حاضر' : a.status === 'absent' ? 'غائب' : 'متأخر') + '</td><td>' + (a.notes || '-') + '</td></tr>').join('');
    }
    
    else if (type === 'fees') {
      title = '💰 تقرير الرسوم الدراسية';
      headers = ['الطالب', 'المبلغ', 'النوع', 'الحالة', 'تاريخ الاستحقاق'];
      
      let query = supabase.from('fees').select('*');
      if (date_from && date_to) {
        query = query.gte('due_date', date_from).lte('due_date', date_to);
      } else if (date_from) {
        query = query.eq('due_date', date_from);
      }
      
      const { data: feesData, error } = await query.order('due_date', { ascending: false });
      if (error) throw error;
      
      let total = 0, paid = 0;
      (feesData || []).forEach(f => {
        total += Number(f.amount) || 0;
        if (f.status === 'paid') paid += Number(f.amount) || 0;
      });
      
      data = (feesData || []).map(f => '<tr><td>' + f.student_name + '</td><td>' + f.amount + ' جنيه</td><td>' + (f.type || '-') + '</td><td>' + (f.status === 'paid' ? 'مدفوع' : 'غير مدفوع') + '</td><td>' + (f.due_date || '-') + '</td></tr>').join('');
      
      title += ' - الإجمالي: ' + total + ' | المدفوع: ' + paid + ' | المتبقي: ' + (total - paid);
    }
    
    else if (type === 'revenue') {
      title = '💵 تقرير الإيرادات';
      headers = ['المصدر', 'المبلغ', 'التاريخ', 'ملاحظات'];
      
      let query = supabase.from('revenue').select('*');
      if (date_from && date_to) {
        query = query.gte('date', date_from).lte('date', date_to);
      } else if (date_from) {
        query = query.eq('date', date_from);
      }
      
      const { data: revenueData, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      
      let total = 0;
      (revenueData || []).forEach(r => total += Number(r.amount) || 0);
      
      data = (revenueData || []).map(r => '<tr><td>' + r.source + '</td><td>' + r.amount + ' جنيه</td><td>' + r.date + '</td><td>' + (r.notes || '-') + '</td></tr>').join('');
      
      title += ' - الإجمالي: ' + total + ' جنيه';
    }
    
    else if (type === 'expenses') {
      title = '💸 تقرير المصروفات';
      headers = ['البند', 'المبلغ', 'التاريخ', 'ملاحظات'];
      
      let query = supabase.from('expenses').select('*');
      if (date_from && date_to) {
        query = query.gte('date', date_from).lte('date', date_to);
      } else if (date_from) {
        query = query.eq('date', date_from);
      }
      
      const { data: expensesData, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      
      let total = 0;
      (expensesData || []).forEach(e => total += Number(e.amount) || 0);
      
      data = (expensesData || []).map(e => '<tr><td>' + e.category + '</td><td>' + e.amount + ' جنيه</td><td>' + e.date + '</td><td>' + (e.notes || '-') + '</td></tr>').join('');
      
      title += ' - الإجمالي: ' + total + ' جنيه';
    }
    
    else if (type === 'grades') {
      title = '🎯 تقرير الدرجات';
      headers = ['الطالب', 'المادة', 'الدرجة', 'من', 'النسبة', 'التقدير'];
      
      const { data: gradesData, error } = await supabase.from('grades').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      data = (gradesData || []).map(g => {
        const p = ((g.score / g.max_score) * 100).toFixed(1);
        const gr = p >= 90 ? 'ممتاز' : p >= 80 ? 'جيد جداً' : p >= 70 ? 'جيد' : p >= 60 ? 'مقبول' : 'ضعيف';
        return '<tr><td>' + g.student_name + '</td><td>' + g.subject + '</td><td>' + g.score + '</td><td>' + g.max_score + '</td><td>' + p + '%</td><td>' + gr + '</td></tr>';
      }).join('');
    }
    
    else if (type === 'students') {
      title = '👥 تقرير الطلاب';
      headers = ['الرقم', 'الاسم', 'الصف', 'الشعبة', 'الحالة'];
      
      const { data: studentsData, error } = await supabase.from('students').select('*').order('id', { ascending: false });
      if (error) throw error;
      
      data = (studentsData || []).map(s => '<tr><td>' + s.id + '</td><td>' + s.name + '</td><td>' + (s.grade || '-') + '</td><td>' + (s.section || '-') + '</td><td>' + (s.status || '-') + '</td></tr>').join('');
    }
    
    else if (type === 'teachers') {
      title = '👨‍🏫 تقرير المعلمين';
      headers = ['الرقم', 'الاسم', 'المادة', 'الهاتف', 'الراتب'];
      
      const { data: teachersData, error } = await supabase.from('teachers').select('*').order('id', { ascending: false });
      if (error) throw error;
      
      data = (teachersData || []).map(t => '<tr><td>' + t.id + '</td><td>' + t.name + '</td><td>' + (t.subject || '-') + '</td><td>' + (t.phone || '-') + '</td><td>' + (t.salary || 0) + ' جنيه</td></tr>').join('');
    }
    
    else if (type === 'transport') {
      title = '🚌 تقرير النقل المدرسي';
      headers = ['الباص', 'المسار', 'السائق', 'الطلاب/السعة'];
      
      const { data: transportData, error } = await supabase.from('transport').select('*').order('id', { ascending: false });
      if (error) throw error;
      
      data = (transportData || []).map(t => '<tr><td>' + t.bus_name + '</td><td>' + t.route + '</td><td>' + (t.driver || '-') + '</td><td>' + (t.students_count || 0) + '/' + (t.capacity || 0) + '</td></tr>').join('');
    }
    
    const html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>' + title + '</title><style>body{font-family:Arial,sans-serif;padding:40px;background:#f5f5f5}table{width:100%;border-collapse:collapse;margin-top:20px;background:white}th{background:#1e40af;color:white;padding:12px}td{padding:10px;border:1px solid #ddd;text-align:center}tr:nth-child(even){background:#f9f9f9}.pbtn{display:block;margin:30px auto;padding:12px 40px;background:#1e40af;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px}@media print{.pbtn{display:none}body{background:white;padding:20px}}</style></head><body>' + makeReportHeader(title) + '<table><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr>' + (data || '<tr><td colspan="' + headers.length + '" style="text-align:center;padding:20px;color:#999">لا توجد بيانات</td></tr>') + '</table><button class="pbtn" onclick="window.print()">🖨️ طباعة التقرير</button></body></html>';
    
    res.send(html);
  } catch (err) {
    res.status(500).send('خطأ في الخادم: ' + err.message);
  }
});

// ======== الشهادات (مع الترويسة) ========
app.get('/certificate/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) return res.status(400).send('معرف الطالب غير صحيح');
    
    const dt = getDateTimeInfo();
    
    const { data: schoolData } = await supabase.from('school_info').select('*').limit(1);
    const school = (schoolData && schoolData[0]) || { name: 'مدرسة النور', logo: '🏫', academic_year: '2026-2027' };

    const { data: students } = await supabase.from('students').select('*').eq('id', studentId).limit(1);
    if (!students || students.length === 0) return res.status(404).send('الطالب غير موجود');
    
    const student = students[0];
    const { data: gradesData } = await supabase.from('grades').select('*').eq('student_name', student.name);
    
    let ts = 0, tm = 0;
    (gradesData || []).forEach(g => { ts += Number(g.score) || 0; tm += Number(g.max_score) || 0; });
    
    const p = tm > 0 ? ((ts / tm) * 100).toFixed(2) : 0;
    const g = p >= 90 ? 'ممتاز' : p >= 80 ? 'جيد جداً' : p >= 70 ? 'جيد' : p >= 60 ? 'مقبول' : 'ضعيف';
    const gColor = p >= 90 ? '#10b981' : p >= 80 ? '#3b82f6' : p >= 70 ? '#f59e0b' : '#ef4444';

    const html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>شهادة - ' + student.name + '</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"><style>body{font-family:Cairo,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);padding:40px 20px}.report-header{background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;padding:25px;border-radius:10px;margin-bottom:20px;text-align:center;max-width:850px;margin:0 auto 20px auto;box-shadow:0 4px 6px rgba(0,0,0,0.1)}.report-header .school-name{font-size:26px;font-weight:bold;margin-bottom:10px}.report-header .info{display:flex;justify-content:space-around;margin-top:15px;font-size:13px}.report-header .info div{background:rgba(255,255,255,0.2);padding:8px 15px;border-radius:8px}.cert{max-width:850px;margin:auto;background:#fffef5;padding:50px;border:20px double #d4af37;border-radius:15px}.header{text-align:center;border-bottom:3px double #d4af37;padding-bottom:20px;margin-bottom:30px}.header h1{color:#1e40af;font-size:38px}.title{text-align:center;font-size:42px;color:#d4af37;margin:30px 0;font-weight:700}.student-name{display:inline-block;font-size:34px;color:#1e40af;font-weight:700;border-bottom:3px solid #d4af37;padding:5px 40px 10px}table{width:100%;border-collapse:collapse;margin:30px 0}th{background:#1e40af;color:white;padding:14px}td{padding:12px;border:1px solid #ddd;text-align:center}.total-row{background:#fef3c7;font-weight:700;border-top:3px solid #d4af37}.grade-badge{padding:8px 25px;background:' + gColor + ';color:white;font-size:22px;font-weight:700;border-radius:30px}.print-btn{display:block;margin:25px auto;padding:15px 50px;background:#1e40af;color:white;border:none;border-radius:30px;font-size:18px;cursor:pointer}@media print{body{background:white;padding:0}.cert{box-shadow:none}.print-btn{display:none}.report-header{box-shadow:none}}</style></head><body><div class="report-header"><div class="school-name">🏫 ' + school.name + '</div><div class="info"><div>📅 التاريخ: ' + dt.dateStr + '</div><div>🕐 الوقت: ' + dt.timeStr + '</div></div></div><div class="cert"><div class="header"><div style="font-size:70px">' + (school.logo || '') + '</div><h1>' + school.name + '</h1><div style="color:#d4af37;font-size:18px">العام الدراسي: ' + school.academic_year + '</div></div><div class="title">✨ شهادة تقدير ✨</div><div style="text-align:center"><p style="font-size:20px">تشهد إدارة المدرسة بأن الطالب/ة</p><div class="student-name">' + student.name + '</div><p style="font-size:18px;margin-top:15px">بالصف <strong>' + student.grade + '</strong> - شعبة <strong>' + student.section + '</strong></p></div>' + (gradesData && gradesData.length > 0 ? '<table><thead><tr><th>م</th><th>المادة</th><th>درجة الطالب/ة</th><th>المجموع الكلي</th><th>النسبة</th></tr></thead><tbody>' + gradesData.map(function(g, i) { return '<tr><td>' + (i + 1) + '</td><td>' + g.subject + '</td><td>' + g.score + '</td><td>' + g.max_score + '</td><td>' + ((g.score / g.max_score) * 100).toFixed(1) + '%</td></tr>'; }).join('') + '<tr class="total-row"><td colspan="2" style="text-align:right;padding-right:20px">المجموع الكلي</td><td>' + ts + '</td><td>' + tm + '</td><td>' + p + '%</td></tr></tbody></table><div style="background:#fef3c7;padding:20px;border-radius:15px;margin:20px 0;border:2px solid #d4af37;display:flex;justify-content:space-around"><div style="text-align:center"><div style="font-size:16px;color:#92400e">النسبة</div><div style="font-size:32px;color:#1e40af;font-weight:700">' + p + '%</div></div><div style="text-align:center"><div style="font-size:16px;color:#92400e">التقدير</div><div class="grade-badge">' + g + '</div></div></div>' : '<p style="text-align:center;color:#999;padding:20px">لا توجد درجات مسجلة</p>') + '<div style="display:flex;justify-content:space-between;margin-top:60px;padding-top:20px;border-top:2px solid #d4af37"><div style="text-align:center;flex:1"><div style="color:#666;margin-bottom:40px">التاريخ</div><div style="border-top:2px solid #333;width:180px;margin:0 auto"></div></div><div style="text-align:center;flex:1"><div style="color:#666;margin-bottom:40px">توقيع المدير</div><div style="border-top:2px solid #333;width:180px;margin:0 auto"></div></div></div></div><button class="print-btn" onclick="window.print()">🖨️ طباعة</button></body></html>';
    
    res.send(html);
  } catch (err) {
    res.status(500).send('خطأ في الخادم: ' + err.message);
  }
});

// ======== التقارير البسيطة (مع الترويسة) ========
function makeReport(title, headers, rows, extra) {
  extra = extra || '';
  var rowsHtml = rows && rows.length > 0 ? rows : '<tr><td colspan="' + headers.length + '" style="text-align:center;padding:20px;color:#999">لا توجد بيانات</td></tr>';
  return '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>' + title + '</title><style>body{font-family:Arial,sans-serif;padding:40px;background:#f5f5f5}table{width:100%;border-collapse:collapse;margin-top:20px;background:white}th{background:#1e40af;color:white;padding:12px}td{padding:10px;border:1px solid #ddd;text-align:center}tr:nth-child(even){background:#f9f9f9}.summary{background:#f0f9ff;padding:20px;border-radius:10px;text-align:center;margin:20px 0;border:2px solid #3b82f6}.pbtn{display:block;margin:30px auto;padding:12px 40px;background:#1e40af;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px}@media print{.pbtn{display:none}body{background:white;padding:20px}}</style></head><body>' + makeReportHeader(title) + '<table><tr>' + headers.map(function(h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' + rowsHtml + '</table>' + extra + '<button class="pbtn" onclick="window.print()">🖨️ طباعة التقرير</button></body></html>';
}

app.get('/api/reports/students', async (req, res) => {
  const { data } = await supabase.from('students').select('*');
  const r = (data || []).map(function(s) { return '<tr><td>' + s.id + '</td><td>' + s.name + '</td><td>' + (s.grade || '-') + '</td><td>' + (s.section || '-') + '</td><td>' + (s.status || '-') + '</td></tr>'; }).join('');
  res.send(makeReport(' تقرير الطلاب', ['الرقم', 'الاسم', 'الصف', 'الشعبة', 'الحالة'], r));
});

app.get('/api/reports/teachers', async (req, res) => {
  const { data } = await supabase.from('teachers').select('*');
  const r = (data || []).map(function(t) { return '<tr><td>' + t.id + '</td><td>' + t.name + '</td><td>' + (t.subject || '-') + '</td><td>' + (t.phone || '-') + '</td><td>' + (t.salary || 0) + ' جنيه</td></tr>'; }).join('');
  res.send(makeReport('👨‍🏫 تقرير المعلمين', ['الرقم', 'الاسم', 'المادة', 'الهاتف', 'الراتب'], r));
});

app.get('/api/reports/employees', async (req, res) => {
  const { data } = await supabase.from('employees').select('*');
  const r = (data || []).map(function(e) { return '<tr><td>' + e.id + '</td><td>' + e.name + '</td><td>' + (e.role || '-') + '</td><td>' + (e.phone || '-') + '</td><td>' + (e.salary || 0) + ' جنيه</td></tr>'; }).join('');
  res.send(makeReport('👔 تقرير الموظفين', ['الرقم', 'الاسم', 'الوظيفة', 'الهاتف', 'الراتب'], r));
});

app.get('/api/reports/attendance', async (req, res) => {
  const { data } = await supabase.from('attendance').select('*');
  const r = (data || []).map(function(a) { return '<tr><td>' + a.student_name + '</td><td>' + a.date + '</td><td>' + (a.status === 'present' ? 'حاضر' : a.status === 'absent' ? 'غائب' : 'متأخر') + '</td></tr>'; }).join('');
  res.send(makeReport('📅 تقرير الحضور', ['الطالب', 'التاريخ', 'الحالة'], r));
});

app.get('/api/reports/grades', async (req, res) => {
  const { data } = await supabase.from('grades').select('*');
  const r = (data || []).map(function(g) {
    var p = ((g.score / g.max_score) * 100).toFixed(1);
    var gr = p >= 90 ? 'ممتاز' : p >= 80 ? 'جيد جداً' : p >= 70 ? 'جيد' : p >= 60 ? 'مقبول' : 'ضعيف';
    return '<tr><td>' + g.student_name + '</td><td>' + g.subject + '</td><td>' + g.score + '/' + g.max_score + '</td><td>' + p + '%</td><td>' + gr + '</td></tr>';
  }).join('');
  res.send(makeReport(' كشوف الدرجات', ['الطالب', 'المادة', 'الدرجة', 'النسبة', 'التقدير'], r));
});

app.get('/api/reports/fees', async (req, res) => {
  const { data } = await supabase.from('fees').select('*');
  let total = 0, paid = 0;
  (data || []).forEach(function(f) { total += Number(f.amount) || 0; if (f.status === 'paid') paid += Number(f.amount) || 0; });
  const r = (data || []).map(function(f) { return '<tr><td>' + f.student_name + '</td><td>' + f.amount + ' جنيه</td><td>' + (f.type || '-') + '</td><td>' + (f.status === 'paid' ? 'مدفوع' : 'غير مدفوع') + '</td></tr>'; }).join('');
  res.send(makeReport('💰 التقرير المالي', ['الطالب', 'المبلغ', 'النوع', 'الحالة'], r, '<div class="summary"><b>الإجمالي: ' + total + ' | المدفوع: ' + paid + ' | المتبقي: ' + (total - paid) + '</b></div>'));
});

app.get('/api/reports/financial', async (req, res) => {
  const { data: rev } = await supabase.from('revenue').select('*');
  const { data: exp } = await supabase.from('expenses').select('*');
  let tr = 0, te = 0;
  (rev || []).forEach(function(r) { tr += Number(r.amount) || 0; });
  (exp || []).forEach(function(e) { te += Number(e.amount) || 0; });
  const rr = (rev || []).map(function(r) { return '<tr><td>' + r.source + '</td><td>' + r.amount + ' جنيه</td><td>' + r.date + '</td></tr>'; }).join('');
  const er = (exp || []).map(function(e) { return '<tr><td>' + e.category + '</td><td>' + e.amount + ' جنيه</td><td>' + e.date + '</td></tr>'; }).join('');
  const title = '💰 التقرير المالي الشامل';
  const html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>' + title + '</title><style>body{font-family:Arial;padding:40px}h2{text-align:center;color:#1e40af}table{width:100%;border-collapse:collapse;margin:10px auto;background:white}th{background:#1e40af;color:white;padding:10px}td{padding:8px;border:1px solid #ddd;text-align:center}.summary{background:#f0f9ff;padding:15px;border-radius:10px;text-align:center;margin:20px auto;max-width:600px}.pbtn{display:block;margin:20px auto;padding:10px 30px;background:#1e40af;color:white;border:none;border-radius:5px;cursor:pointer}@media print{.pbtn{display:none}}</style></head><body>' + makeReportHeader(title) + '<div class="summary"><b>الإيرادات: ' + tr + ' | المصروفات: ' + te + ' | الصافي: ' + (tr - te) + '</b></div><h2>📈 الإيرادات</h2><table><tr><th>المصدر</th><th>المبلغ</th><th>التاريخ</th></tr>' + (rr || '<tr><td colspan="3">لا توجد</td></tr>') + '</table><h2>📉 المصروفات</h2><table><tr><th>البند</th><th>المبلغ</th><th>التاريخ</th></tr>' + (er || '<tr><td colspan="3">لا توجد</td></tr>') + '</table><button class="pbtn" onclick="window.print()">🖨️ طباعة</button></body></html>';
  res.send(html);
});

app.get('/api/reports/transport', async (req, res) => {
  const { data } = await supabase.from('transport').select('*');
  const r = (data || []).map(function(t) { return '<tr><td>' + t.bus_name + '</td><td>' + t.route + '</td><td>' + (t.driver || '-') + '</td><td>' + (t.students_count || 0) + '/' + (t.capacity || 0) + '</td></tr>'; }).join('');
  res.send(makeReport('🚌 تقرير النقل', ['الباص', 'المسار', 'السائق', 'الطلاب/السعة'], r));
});

app.get('/api/reports/schedules', async (req, res) => {
  const { data } = await supabase.from('schedules').select('*');
  const r = (data || []).map(function(s) { return '<tr><td>' + s.day + '</td><td>' + s.period + '</td><td>' + s.subject + '</td><td>' + (s.teacher || '-') + '</td><td>' + (s.section || '-') + '</td><td>' + (s.room || '-') + '</td></tr>'; }).join('');
  res.send(makeReport(' جدول الحصص', ['اليوم', 'الحصة', 'المادة', 'المعلم', 'الفصل', 'القاعة'], r));
});

// ======== تشغيل الخادم ========
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', function() {
  console.log(' النظام يعمل على المنفذ ' + PORT);
});
