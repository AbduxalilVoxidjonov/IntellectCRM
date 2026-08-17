/* Landing sahifasi skripti — ALOHIDA faylda, chunki prod CSP (script-src 'self')
   HTML ichidagi inline skriptni bloklaydi (inline bo'lsa tugmalar umuman ishlamaydi). */
(function(){
  'use strict';

  var modalBackdrop = document.getElementById('modalBackdrop');
  var modalClose = document.getElementById('modalClose');
  var openTriggers = document.querySelectorAll('[data-open-modal]');
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  var subjectSelect = document.getElementById('leadSubject');

  function openModal(selectedSubject){
    if (selectedSubject && subjectSelect) {
      for (var i = 0; i < subjectSelect.options.length; i++) {
        if (subjectSelect.options[i].value === selectedSubject) {
          subjectSelect.selectedIndex = i;
          break;
        }
      }
    }
    modalBackdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(){
    modalBackdrop.classList.remove('show');
    document.body.style.overflow = '';
  }

  openTriggers.forEach(function(btn){
    btn.addEventListener('click', function(){
      var subj = btn.getAttribute('data-subject');
      openModal(subj);
    });
  });

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', function(e){
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && modalBackdrop.classList.contains('show')) closeModal();
  });

  // Mobil menyu toggle
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function(){
      navLinks.classList.toggle('show');
    });

    // Nav-link bosilganda mobil menyuni yopish
    var links = navLinks.querySelectorAll('a');
    links.forEach(function(link){
      link.addEventListener('click', function(){
        navLinks.classList.remove('show');
      });
    });
  }

  // FAQ Akordeon
  var faqToggles = document.querySelectorAll('[data-faq-toggle]');
  faqToggles.forEach(function(btn){
    btn.addEventListener('click', function(){
      var item = btn.closest('.faq-item');
      if (item) {
        var isOpen = item.classList.contains('active');
        document.querySelectorAll('.faq-item').forEach(function(fi){
          fi.classList.remove('active');
        });
        if (!isOpen) {
          item.classList.add('active');
        }
      }
    });
  });

  // Brend ma'lumotlarini dinamik yuklash
  fetch('/api/public/brand').then(function(res){
    if (!res.ok) return null;
    return res.json();
  }).then(function(brand){
    if (!brand) return;
    if (brand.logoUrl) {
      var mark = document.getElementById('brandMark');
      if (mark) mark.innerHTML = '<img src="' + brand.logoUrl + '" alt="logo">';
    }
    if (brand.name) {
      ['brandName', 'brandNameCopy', 'brandNameFooter'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.textContent = brand.name;
      });
    }
    if (brand.phone) {
      var fab = document.getElementById('fabPhone');
      if (fab) fab.setAttribute('href', 'tel:' + brand.phone.replace(/[^\d+]/g, ''));
    }
  }).catch(function(){});

  var form = document.getElementById('leadForm');
  var formWrap = document.getElementById('formWrap');
  var msgEl = document.getElementById('leadFormMsg');
  var submitBtn = document.getElementById('leadSubmitBtn');
  var nameInput = document.getElementById('leadName');
  var phoneInput = document.getElementById('leadPhone');

  function showError(text){
    msgEl.textContent = text;
    msgEl.classList.add('error');
  }
  function clearError(){
    msgEl.textContent = '';
    msgEl.classList.remove('error');
  }

  function digitsOnly(str){
    return (str || '').replace(/\D/g, '');
  }

  phoneInput.addEventListener('input', clearError);
  nameInput.addEventListener('input', clearError);

  if (subjectSelect) subjectSelect.addEventListener('change', clearError);

  form.addEventListener('submit', function(event){
    event.preventDefault();
    clearError();

    var fullName = nameInput.value.trim();
    var phone = phoneInput.value.trim();
    var subject = subjectSelect ? subjectSelect.value : '';

    if (!fullName) {
      showError('Iltimos, ismingizni kiriting.');
      nameInput.focus();
      return;
    }
    if (digitsOnly(phone).length < 9) {
      showError('Iltimos, to\'g\'ri telefon raqam kiriting (kamida 9 ta raqam).');
      phoneInput.focus();
      return;
    }
    if (!subject) {
      showError('Iltimos, yo\'nalishni tanlang.');
      if (subjectSelect) subjectSelect.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Yuborilmoqda…';

    fetch('/api/public/landing-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: fullName, phone: phone, subject: subject })
    }).then(function(response){
      if (response.ok) {
        formWrap.innerHTML =
          '<div class="form-success">' +
            '<div class="ic">✅</div>' +
            '<h4>Arizangiz qabul qilindi!</h4>' +
            '<p>Tez orada siz bilan bog\'lanamiz.</p>' +
          '</div>';
        return null;
      }
      if (response.status === 400 || response.status === 429) {
        return response.json().catch(function(){ return null; }).then(function(data){
          var message = (data && data.message) ? data.message : 'Xatolik yuz berdi, qayta urinib ko\'ring yoki qo\'ng\'iroq qiling.';
          showError(message);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Ariza qoldirish';
        });
      }
      showError('Xatolik yuz berdi, qayta urinib ko\'ring yoki qo\'ng\'iroq qiling.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ariza qoldirish';
      return null;
    }).catch(function(){
      showError('Xatolik yuz berdi, qayta urinib ko\'ring yoki qo\'ng\'iroq qiling.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ariza qoldirish';
    });
  });

  function updateNavCta(){
    var isSmall = window.innerWidth <= 600;
    var navBtn = document.querySelector('.nav-actions .btn-primary');
    if (!navBtn) return;
    var full = navBtn.querySelector('.nav-cta-full');
    var short = navBtn.querySelector('.nav-cta-short');
    if (!full || !short) return;
    full.style.display = isSmall ? 'none' : 'inline';
    short.style.display = isSmall ? 'inline' : 'none';
  }
  updateNavCta();
  window.addEventListener('resize', updateNavCta);
})();
