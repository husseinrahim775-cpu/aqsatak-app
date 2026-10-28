export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto p-8 font-sans dir-rtl text-right space-y-6">
      <h1 className="text-3xl font-bold">سياسة الخصوصية (Privacy Policy)</h1>
      <p className="text-gray-600">تاريخ آخر تحديث: {new Date().toLocaleDateString('ar-IQ')}</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. المعلومات التي نجمعها</h2>
        <p>
          تطبيق **Aqsatak App** يجمع فقط البيانات التي تختار إدخالها بنفسك لإدارة الأقساط والمبيعات (مثل أسماء العملاء، المبالغ، والتواريخ). عند ربط Google Drive، نطلب الإذن فقط لإدارة الملفات التي ينشئها تطبيقنا للنسخ الاحتياطي (`drive.file`).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. كيف نستخدم بياناتك</h2>
        <p>
          نستخدم بياناتك حصراً لتقديم خدمات إدارة الأقساط، وحفظ النسخ الاحتياطية في حساب Google Drive الخاص بك بشكل آمن دون الاطلاع عليها من قبل أطراف خارجية.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. حماية البيانات والأمان</h2>
        <p>
          نلتزم بتطبيق أقصى معايير الأمان لحماية بياناتك، ولا نبيع أو نشارك أي بيانات مع أي جهة ثالثة.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. التواصل معنا</h2>
        <p>إذا كان لديك أي استفسار حول سياسة الخصوصية، يمكنك التواصل عبر البريد الإلكتروني الخاص بالدعم.</p>
      </section>
    </div>
  );
}