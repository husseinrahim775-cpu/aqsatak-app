export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto p-8 font-sans dir-rtl text-right space-y-6">
      <h1 className="text-3xl font-bold">شروط الخدمة (Terms of Service)</h1>
      <p className="text-gray-600">تاريخ آخر تحديث: {new Date().toLocaleDateString('ar-IQ')}</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. قبول الشروط</h2>
        <p>
          باستخدامك لتطبيق **Aqsatak App**، فإنك توافق على الالتزام بشروط الخدمة هذه وكافة القوانين واللوائح المعمول بها.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. مسؤولية الحساب</h2>
        <p>
          المستخدم مسؤول عن الحفاظ على سرية بيانات حسابه، وتأمين المفاتيح والرموز الخاصة بربط الخدمات الخارجية مثل Google Drive.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. استخدام Google Drive</h2>
        <p>
          الربط مع Google Drive يتم برغبة المستخدم الكاملة لحفظ النسخ الاحتياطية، ويمكنك إلغاء الربط في أي وقت من إعدادات النظام أو من إعدادات أمان حساب غوغل.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. التعديلات على الشروط</h2>
        <p>
          نحتفظ بالحق في تعديل هذه الشروط في أي وقت، وسيتم إشعار المستخدمين بأي تغييرات جوهرية.
        </p>
      </section>
    </div>
  );
}