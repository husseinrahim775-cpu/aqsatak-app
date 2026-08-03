import { db } from "./firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where, 
  serverTimestamp,
  updateDoc,
  deleteDoc // تم إضافة دالة الحذف هنا
} from "firebase/firestore";

// واجهة بيانات القسط والعميل
export interface InstallmentData {
  id?: string;
  userId: string;
  customerName: string;
  phoneNumber: string;
  address: string;
  guarantorName: string;
  guarantorPhone: string;
  productName: string;
  productPrice: number;
  downPayment: number;
  profitMargin: number;
  months: number;
  totalDue: number;
  totalProfit: number;
  monthlyInstallment: number;
  startDate?: string;
  createdAt?: any;
}

// واجهة تسديد الدفعة
export interface PaymentRecord {
  id?: string;
  installmentId: string;
  userId: string;
  customerName?: string;
  productName?: string;
  amount: number;
  paidAt?: any;
  createdAt?: any;
}

// 1. إضافة قسط جديد مرتبط بالمستخدم الحالي
export const addInstallmentRecord = async (data: Omit<InstallmentData, "id" | "createdAt">) => {
  try {
    const docRef = await addDoc(collection(db, "installments"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في حفظ القسط:", error);
    return { success: false, id: null, error };
  }
};

// 2. جلب جميع أقساط وعملاء المستخدم الحالي فقط
export const getUserInstallments = async (userId: string) => {
  try {
    const q = query(collection(db, "installments"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const installments: InstallmentData[] = [];
    
    querySnapshot.forEach((docSnap) => {
      installments.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as InstallmentData);
    });
    
    return installments;
  } catch (error) {
    console.error("خطأ في جلب بيانات الأقساط:", error);
    throw error;
  }
};

// 3. جلب تفاصيل قسط/عميل معين بواسطة الـ ID
export const getInstallmentById = async (id: string) => {
  try {
    const docRef = doc(db, "installments", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as InstallmentData;
    }
    return null;
  } catch (error) {
    console.error("خطأ في جلب تفاصيل القسط:", error);
    throw error;
  }
};

// 4. تسديد دفعة جديدة وتحديث المتبقي للتقسيط تلقائياً
export const addPaymentRecord = async (data: Omit<PaymentRecord, "id">) => {
  try {
    // 1. إضافة الدفعة لسجل المقبوضات
    const docRef = await addDoc(collection(db, "payments"), {
      ...data,
      paidAt: data.paidAt || new Date().toISOString(),
      createdAt: serverTimestamp(),
    });

    // 2. تحديث المبلغ المتبقي (totalDue) في القسط نفسه
    if (data.installmentId && data.amount) {
      const instRef = doc(db, "installments", data.installmentId);
      const instSnap = await getDoc(instRef);

      if (instSnap.exists()) {
        const currentTotalDue = instSnap.data().totalDue || 0;
        const newTotalDue = Math.max(0, currentTotalDue - data.amount);
        
        // تحديث المستند في الفايرستور
        await updateDoc(instRef, {
          totalDue: newTotalDue,
        });
      }
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في إضافة الدفعة وتحديث القسط:", error);
    return { success: false, error };
  }
};

// اسم مستعار للدالة القديمة لضمان عدم حدوث كسر في أجزاء المشروع الأخرى
export const recordPayment = async (installmentId: string, userId: string, amount: number) => {
  return addPaymentRecord({
    installmentId,
    userId,
    amount,
  });
};

// 5. جلب جميع الدفعات المسددة لمستخدم معين
export const getUserPayments = async (userId: string) => {
  try {
    const q = query(collection(db, "payments"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const payments: PaymentRecord[] = [];
    querySnapshot.forEach((docSnap) => {
      payments.push({ id: docSnap.id, ...docSnap.data() } as PaymentRecord);
    });
    return payments;
  } catch (error) {
    console.error("خطأ في جلب السجلات:", error);
    throw error;
  }
};

// 6. جلب جميع أقساط عميل معين برقم الهاتف
export const getInstallmentsByPhone = async (userId: string, phoneNumber: string) => {
  try {
    const q = query(
      collection(db, "installments"),
      where("userId", "==", userId),
      where("phoneNumber", "==", phoneNumber)
    );
    const querySnapshot = await getDocs(q);
    const list: InstallmentData[] = [];
    querySnapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as InstallmentData);
    });
    return list;
  } catch (error) {
    console.error("خطأ في جلب أقساط العميل:", error);
    return [];
  }
};


// ==========================================
// ====== الدوال الجديدة (التعديل والحذف) ======
// ==========================================

// 7. تحديث بيانات قسط/عميل معين
export const updateInstallment = async (installmentId: string, updatedData: Partial<InstallmentData>) => {
  try {
    const docRef = doc(db, "installments", installmentId);
    await updateDoc(docRef, {
      ...updatedData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("خطأ في تحديث بيانات العميل/القسط:", error);
    throw error;
  }
};

// 8. حذف قسط/عميل بالكامل
export const deleteInstallment = async (installmentId: string) => {
  try {
    const docRef = doc(db, "installments", installmentId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("خطأ في حذف القسط:", error);
    throw error;
  }
};
// 9. تعديل دفعة مسددة (مع تسوية المتبقي للقسط تلقائياً)
export const updatePaymentRecord = async (
  paymentId: string,
  installmentId: string,
  oldAmount: number,
  newAmount: number,
  updatedData: Partial<PaymentRecord>
) => {
  try {
    // 1. تحديث بيانات الدفعة في سجل المقبوضات
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      ...updatedData,
      updatedAt: serverTimestamp(),
    });

    // 2. تحديث المتبقي من القسط إذا تم تغيير المبلغ
    if (oldAmount !== newAmount) {
      const instRef = doc(db, "installments", installmentId);
      const instSnap = await getDoc(instRef);
      if (instSnap.exists()) {
        const currentTotalDue = instSnap.data().totalDue || 0;
        // إرجاع المبلغ القديم ثم طرح المبلغ الجديد لمعرفة الصافي
        const newTotalDue = Math.max(0, currentTotalDue + oldAmount - newAmount);
        await updateDoc(instRef, { totalDue: newTotalDue });
      }
    }
    return true;
  } catch (error) {
    console.error("خطأ في تعديل الدفعة:", error);
    throw error;
  }
};

// 10. حذف دفعة مسددة (مع إرجاع قيمتها للمتبقي من القسط)
export const deletePaymentRecord = async (paymentId: string, installmentId: string, amount: number) => {
  try {
    // 1. حذف الدفعة من سجل المقبوضات
    const paymentRef = doc(db, "payments", paymentId);
    await deleteDoc(paymentRef);

    // 2. إرجاع المبلغ المحذوف إلى إجمالي المتبقي للقسط
    const instRef = doc(db, "installments", installmentId);
    const instSnap = await getDoc(instRef);
    if (instSnap.exists()) {
      const currentTotalDue = instSnap.data().totalDue || 0;
      await updateDoc(instRef, { totalDue: currentTotalDue + amount });
    }
    return true;
  } catch (error) {
    console.error("خطأ في حذف الدفعة:", error);
    throw error;
  }
};