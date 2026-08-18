/* Sertifikatlar sahifasi skripti — ALOHIDA faylda, chunki prod CSP (script-src 'self')
   HTML ichidagi inline skriptni bloklaydi. Ilgari butun mantiq sahifaning O'ZIDA <script>
   tegida turardi: lokalda (CSP yo'q) ishlar, PRODDA esa sertifikatlar yuklanmas, filtr va
   qidiruv o'lik bo'lar va ariza formasi (POST /api/public/leads) umuman yubormasdi.
   Uslub landing.js bilan bir xil: ES5 (var/function), tashqi kutubxonasiz. */
(function(){
  'use strict';

  // Boshlang'ich (zaxira) ma'lumot — server javobi kelguncha yoki bo'sh bo'lsa ko'rsatiladi.
  // ⚠️ Rasm manzillari MUTLAQ (`/img/...`): sahifa `MapFallback` orqali `/sertifikatlar` da ham,
  // `/sertifikatlar/` (oxirida slash) da ham beriladi. Nisbiy `img/...` ikkinchisida
  // `/sertifikatlar/img/...` bo'lib 404 qaytarardi va kartochkalar rasmsiz chiqardi.
  var defaultCertificates = [
    { studentName: 'MUKHAMMADISA MAKHMUDOV', overallScore: '8.5', listening: '9.0', reading: '8.5', writing: '7.5', speaking: '8.0', imageUrl: '/img/certificates/cert-1.jpg', category: 'Xalqaro', certType: 'IELTS' },
    { studentName: 'KRISTINA KHAFIZOVA', overallScore: '8.0', listening: '8.5', reading: '8.0', writing: '7.5', speaking: '8.5', imageUrl: '/img/certificates/cert-2.jpg', category: 'Xalqaro', certType: 'IELTS' },
    { studentName: 'SHAHZODBEK RAXIMOV', overallScore: 'C1', listening: '72', reading: '68', writing: '65', speaking: '70', imageUrl: '/img/certificates/cert-1.jpg', category: 'Xalqaro', certType: 'Multilevel' },
    { studentName: 'MADINABONU MIRZAYEVA', overallScore: 'A+', listening: '-', reading: '-', writing: '-', speaking: '-', imageUrl: '/img/certificates/cert-2.jpg', category: 'Milliy', certType: 'Milliy' }
  ];

  var allCertificates = defaultCertificates;
  var currentFilter = 'all';
  var currentSearch = '';
  var currentLeadNote = 'Sertifikatlar sahifasidan';

  var certsGrid = document.getElementById('certsGrid');
  var searchInput = document.getElementById('certSearchInput');
  var filterTabs = document.querySelectorAll('.filter-tab');

  var leadModalBackdrop = document.getElementById('leadModalBackdrop');
  var leadModalClose = document.getElementById('leadModalClose');
  var leadForm = document.getElementById('leadForm');
  var leadFormMsg = document.getElementById('leadFormMsg');
  var leadSubjectSelect = document.getElementById('leadSubject');
  var leadNameInput = document.getElementById('leadName');
  var leadPhoneInput = document.getElementById('leadPhone');
  var openHeaderLeadBtn = document.getElementById('openHeaderLeadBtn');

  var resultModalBackdrop = document.getElementById('resultModalBackdrop');
  var resultModalClose = document.getElementById('resultModalClose');
  var resultModalImg = document.getElementById('resultModalImg');
  var resultModalStudentName = document.getElementById('resultModalStudentName');
  var resultModalOverall = document.getElementById('resultModalOverall');
  var resultModalListening = document.getElementById('resultModalListening');
  var resultModalReading = document.getElementById('resultModalReading');
  var resultModalWriting = document.getElementById('resultModalWriting');
  var resultModalSpeaking = document.getElementById('resultModalSpeaking');
  var resultModalCategory = document.getElementById('resultModalCategory');
  var resultModalCta = document.getElementById('resultModalCta');

  // CMS'dan matn ham, RAQAM ham keladi (masalan overallScore: 8.5) — xom raqamda `.replace`
  // metodi yo'q va TypeError butun ro'yxatni chizilmay qoldirardi, shuning uchun String().
  function escapeHtml(str) {
    if (str === null || str === undefined || str === '') return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function digitsOnly(str) {
    return (str || '').replace(/\D/g, '');
  }

  // Modal ochilganda sahifa ORQADA sirg'anmasin (landing.js dagi bilan bir xil uslub).
  function showBackdrop(el) {
    if (!el) return;
    el.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function hideBackdrop(el) {
    if (!el) return;
    el.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ===================== ARIZA MODALI =====================

  function openLeadModal(subject, note) {
    if (subject && leadSubjectSelect) leadSubjectSelect.value = subject;
    currentLeadNote = note || 'Sertifikatlar sahifasidan';
    showBackdrop(leadModalBackdrop);
  }
  function closeLeadModal() { hideBackdrop(leadModalBackdrop); }

  if (openHeaderLeadBtn) {
    openHeaderLeadBtn.addEventListener('click', function() {
      openLeadModal('', 'Sertifikatlar sahifasi tepasidan');
    });
  }
  if (leadModalClose) leadModalClose.addEventListener('click', closeLeadModal);
  if (leadModalBackdrop) {
    leadModalBackdrop.addEventListener('click', function(e) {
      if (e.target === leadModalBackdrop) closeLeadModal();
    });
  }

  // ===================== SERTIFIKAT MODALI =====================

  function openResultModal(c) {
    if (resultModalStudentName) resultModalStudentName.textContent = c.studentName || 'O\'QUVCHI';
    if (resultModalOverall) resultModalOverall.textContent = c.overallScore || '8.5';
    if (resultModalListening) resultModalListening.textContent = c.listening || '-';
    if (resultModalReading) resultModalReading.textContent = c.reading || '-';
    if (resultModalWriting) resultModalWriting.textContent = c.writing || '-';
    if (resultModalSpeaking) resultModalSpeaking.textContent = c.speaking || '-';
    if (resultModalImg) resultModalImg.src = c.imageUrl || '/img/certificates/cert-1.jpg';
    if (resultModalCategory) resultModalCategory.textContent = (c.certType || 'SERTIFIKAT') + ' (' + (c.category || 'Xalqaro') + ')';
    showBackdrop(resultModalBackdrop);
  }
  function closeResultModal() { hideBackdrop(resultModalBackdrop); }

  if (resultModalClose) resultModalClose.addEventListener('click', closeResultModal);
  if (resultModalBackdrop) {
    resultModalBackdrop.addEventListener('click', function(e) {
      if (e.target === resultModalBackdrop) closeResultModal();
    });
  }
  if (resultModalCta) {
    resultModalCta.addEventListener('click', function() {
      var who = resultModalStudentName ? resultModalStudentName.textContent : '';
      closeResultModal();
      openLeadModal('IELTS', 'Sertifikatlar sahifasidan: ' + who + ' natijasi orqali');
    });
  }

  // Escape ikkala modalni ham yopadi — foydalanuvchi "✕" ni qidirib qolmasin.
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    if (resultModalBackdrop && resultModalBackdrop.classList.contains('show')) closeResultModal();
    else if (leadModalBackdrop && leadModalBackdrop.classList.contains('show')) closeLeadModal();
  });

  // ===================== RO'YXAT =====================

  function matchesFilter(c) {
    var catLower = (currentFilter || 'all').toLowerCase();
    if (catLower === 'all') return true;

    var typeLower = (c.certType || '').toLowerCase();
    var titleLower = (c.title || '').toLowerCase();
    var cCategoryLower = (c.category || '').toLowerCase();

    if (catLower === 'xalqaro') {
      return typeLower.indexOf('ielts') !== -1 || typeLower.indexOf('multi') !== -1 || typeLower.indexOf('cefr') !== -1 ||
             titleLower.indexOf('ielts') !== -1 || titleLower.indexOf('multi') !== -1 || cCategoryLower.indexOf('xalqaro') !== -1;
    }
    if (catLower === 'milliy') {
      return typeLower.indexOf('sat') !== -1 || typeLower.indexOf('milli') !== -1 ||
             titleLower.indexOf('sat') !== -1 || titleLower.indexOf('milli') !== -1 || cCategoryLower.indexOf('milliy') !== -1;
    }
    return cCategoryLower === catLower || typeLower.indexOf(catLower) !== -1 || titleLower.indexOf(catLower) !== -1;
  }

  function matchesSearch(c) {
    var s = (currentSearch || '').trim().toLowerCase();
    if (!s) return true;
    // Qiymat raqam bo'lishi mumkin — String() bo'lmasa .toLowerCase() yiqilardi.
    var fields = [c.studentName, c.overallScore, c.title, c.certType];
    for (var i = 0; i < fields.length; i++) {
      var v = fields[i];
      if (v !== null && v !== undefined && String(v).toLowerCase().indexOf(s) !== -1) return true;
    }
    return false;
  }

  function renderGrid() {
    if (!certsGrid) return;
    certsGrid.innerHTML = '';

    var list = allCertificates.filter(function(c) {
      return matchesFilter(c) && matchesSearch(c);
    });

    if (list.length === 0) {
      certsGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:60px 0; color:var(--muted); font-size:16px;">Sertifikatlar topilmadi.</div>';
      return;
    }

    list.forEach(function(c) {
      var card = document.createElement('div');
      card.className = 'result-card';
      // ⚠️ Har bir CMS qiymati escape qilinadi: matnda "<" bo'lsa kartochka markup'i buzilardi.
      card.innerHTML =
        '<div class="result-cert-img-wrap">' +
          '<img src="' + escapeHtml(c.imageUrl || '/img/certificates/cert-1.jpg') + '" alt="' + escapeHtml(c.studentName || 'Sertifikat') + '" loading="lazy">' +
        '</div>' +
        '<div class="result-student-name">' + (escapeHtml(c.studentName) || 'O\'QUVCHI') + '</div>' +
        '<div class="result-card-bottom">' +
          '<div class="result-overall-box">' +
            '<span class="result-overall-label">' + (escapeHtml(c.certType) || 'OVERALL') + '</span>' +
            '<span class="result-overall-score">' + (escapeHtml(c.overallScore) || '8.5') + '</span>' +
          '</div>' +
          '<div class="result-breakdown">' +
            '<div class="result-breakdown-row"><span>List:</span> <span>' + (escapeHtml(c.listening) || '-') + '</span></div>' +
            '<div class="result-breakdown-row"><span>Read:</span> <span>' + (escapeHtml(c.reading) || '-') + '</span></div>' +
            '<div class="result-breakdown-row"><span>Writ:</span> <span>' + (escapeHtml(c.writing) || '-') + '</span></div>' +
            '<div class="result-breakdown-row"><span>Spea:</span> <span>' + (escapeHtml(c.speaking) || '-') + '</span></div>' +
          '</div>' +
        '</div>';

      card.style.cursor = 'pointer';
      card.addEventListener('click', function() { openResultModal(c); });
      certsGrid.appendChild(card);
    });
  }

  filterTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      filterTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter') || 'all';
      renderGrid();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      currentSearch = searchInput.value;
      renderGrid();
    });
  }

  // Avval zaxira ro'yxat chiziladi — tarmoq sekin bo'lsa ham sahifa bo'sh turmasin.
  renderGrid();

  fetch('/api/public/landing-data').then(function(res) {
    if (!res.ok) return null;
    return res.json();
  }).then(function(data) {
    if (data && data.certificates && data.certificates.length > 0) {
      allCertificates = data.certificates;
      renderGrid();
    }
  }).catch(function() {});

  // Footerdagi yil — qo'lda yozilgan sana eskirib qolmasin.
  var certYear = document.getElementById('certYear');
  if (certYear) certYear.textContent = String(new Date().getFullYear());

  // ===================== ARIZA YUBORISH =====================

  function setLeadMsg(text, color) {
    if (!leadFormMsg) return;
    leadFormMsg.textContent = text;
    leadFormMsg.style.color = color;
  }

  if (leadForm) {
    var leadSubmitBtn = leadForm.querySelector('button[type="submit"]');

    leadForm.addEventListener('submit', function(e) {
      e.preventDefault();

      var name = leadNameInput ? leadNameInput.value.trim() : '';
      var phone = leadPhoneInput ? leadPhoneInput.value.trim() : '';
      var subject = leadSubjectSelect ? leadSubjectSelect.value : '';

      // Ilgari `if (!name || !phone) return;` — forma JIM turib qolardi va foydalanuvchi
      // nima noto'g'ri ekanini bilmasdi.
      if (!name) {
        setLeadMsg('Iltimos, ismingizni kiriting.', '#f87171');
        if (leadNameInput) leadNameInput.focus();
        return;
      }
      if (digitsOnly(phone).length < 9) {
        setLeadMsg('Iltimos, to\'g\'ri telefon raqam kiriting (kamida 9 ta raqam).', '#f87171');
        if (leadPhoneInput) leadPhoneInput.focus();
        return;
      }

      setLeadMsg('Yuborilmoqda...', '#38bdf8');
      if (leadSubmitBtn) leadSubmitBtn.disabled = true;

      fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: name, phone: phone, subject: subject, note: currentLeadNote })
      }).then(function(res) {
        if (res.ok) {
          setLeadMsg('✅ Arizangiz muvaffaqiyatli yuborildi!', '#4ade80');
          leadForm.reset();
          setTimeout(closeLeadModal, 2000);
          return null;
        }
        // 400/429 da server sababni yozadi (masalan "juda tez-tez yuborilmoqda") — uni ko'rsatamiz.
        return res.json().catch(function() { return null; }).then(function(data) {
          setLeadMsg('❌ ' + ((data && data.message) ? data.message : 'Xatolik yuz berdi. Qayta urinib ko\'ring.'), '#f87171');
        });
      }).catch(function() {
        setLeadMsg('❌ Xatolik yuz berdi.', '#f87171');
      }).finally(function() {
        if (leadSubmitBtn) leadSubmitBtn.disabled = false;
      });
    });
  }
})();
