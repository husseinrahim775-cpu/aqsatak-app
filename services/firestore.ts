import { db, storage, auth } from "./firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  updateDoc,
  deleteDoc 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ==========================================
// ====== الواجهات والمجسمات (Interfaces) ======
// ==========================================

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
  months: number; // يمثل عدد الدفعات (عدد الأيام / الأسابيع / الأشهر)
  paymentPeriod?: "daily" | "weekly" | "monthly"; // (يومي / أسبوعي / شهري)
  totalDue: number;
  totalProfit: number;
  monthlyInstallment: number; // المبلغ المطلوب في كل دفعة
  startDate?: string;
  createdAt?: any;
  paidMonths?: string[];
  documents?: {
    idCardUrl?: string;
    contractUrl?: string;
    personalPhotoUrl?: string;
    otherDocUrls?: string[];
  };
}

export interface PaymentRecord {
  id?: string;
  installmentId: string;
  userId: string;
  customerName?: string;
  productName?: string;
  amount: number;
  paidAt?: any;
  createdAt?: any;
  targetMonth?: string; 
  notes?: string;     
  isPenalty?: boolean;     
}

export interface DebtData {
  id?: string;
  userId: string;
  customerName: string;
  phoneNumber: string;
  amount: number;
  reason: string;
  isPaid: boolean;
  createdAt: any;
}

export interface InventoryItem {
  id?: string;
  ownerUid?: string;          // ID الشركة الممالكة للمنتج
  title: string;          
  category: string;       
  price: number;   
  costPrice?: number;     // 👈 أضف هذا السطر هنا ليختفي الخط الأحمر فوراً       
  status: "available" | "sold";
  specs?: {
    chassisNumber?: string;
    color?: string;         
    modelYear?: string;     
    [key: string]: any;     
  };
  soldToClientId?: string;
  soldToClientName?: string;
  contractId?: string;
  soldAt?: string;
}

// ==========================================
// ====== 0. دالة رفع الصور والمستندات ======
// ==========================================

export const uploadCustomerDocument = async (file: File, folderName: string): Promise<string> => {
  try {
    const fileRef = ref(storage, `documents/${folderName}/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const downloadUrl = await getDownloadURL(fileRef);
    return downloadUrl;
  } catch (error) {
    console.error("خطأ في رفع صورة المستند:", error);
    throw error;
  }
};

// ==========================================
// ====== 1. إدارة الأقساط والعملاء ======
// ==========================================

export const addInstallmentRecord = async (data: Omit<InstallmentData, "id" | "createdAt">) => {
  try {
    const docRef = await addDoc(collection(db, "installments"), {
      ...data,
      paidMonths: [],
      createdAt: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في حفظ القسط:", error);
    return { success: false, id: null, error };
  }
};

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

export const deleteInstallment = async (installmentId: string) => {
  try {
    // 1. البحث في المخزن عن أي مادة مرتبطة بهذا العقد
    const q = query(
      collection(db, "inventory"), 
      where("contractId", "==", installmentId)
    );
    const querySnapshot = await getDocs(q);

    // 2. إرجاع المواد المرتبطة إلى حالة "متوفر" وإلغاء بيانات البيع
    const resetPromises = querySnapshot.docs.map((docSnap) => {
      const itemRef = doc(db, "inventory", docSnap.id);
      return updateDoc(itemRef, {
        status: "available",
        soldToClientId: "",
        soldToClientName: "",
        contractId: "",
        soldAt: "",
      });
    });

    await Promise.all(resetPromises);

    // 3. حذف القسط نفسه من قاعدة البيانات
    const docRef = doc(db, "installments", installmentId);
    await deleteDoc(docRef);

    return true;
  } catch (error) {
    console.error("خطأ في حذف القسط وإرجاع المادة للمخزن:", error);
    throw error;
  }
};

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
// ====== 2. سجل المقبوضات والدفعات ======
// ==========================================

export const addPaymentRecord = async (data: Omit<PaymentRecord, "id">) => {
  try {
    const paymentPayload: any = {
      ...data,
      paidAt: data.paidAt || new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    if (paymentPayload.targetMonth === undefined) delete paymentPayload.targetMonth;
    if (paymentPayload.notes === undefined) delete paymentPayload.notes;

    const docRef = await addDoc(collection(db, "payments"), paymentPayload);

    if (data.installmentId && data.amount) {
      const instRef = doc(db, "installments", data.installmentId);
      const instSnap = await getDoc(instRef);

      if (instSnap.exists()) {
        const instData = instSnap.data() as InstallmentData;
        const currentTotalDue = instData.totalDue || 0;
        const newTotalDue = Math.max(0, currentTotalDue - data.amount);
        
        const currentPaidMonths = instData.paidMonths || [];
        const updatedPaidMonths = [...currentPaidMonths];

        if (data.targetMonth && !updatedPaidMonths.includes(data.targetMonth)) {
          updatedPaidMonths.push(data.targetMonth);
        }
        
        await updateDoc(instRef, {
          totalDue: newTotalDue,
          paidMonths: updatedPaidMonths,
        });
      }
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في إضافة الدفعة وتحديث القسط:", error);
    return { success: false, error };
  }
};

export const recordPayment = async (installmentId: string, userId: string, amount: number) => {
  return addPaymentRecord({
    installmentId,
    userId,
    amount,
  });
};

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

export const updatePaymentRecord = async (
  paymentId: string,
  installmentId: string,
  oldAmount: number,
  newAmount: number,
  updatedData: Partial<PaymentRecord>
) => {
  try {
    const cleanData = { ...updatedData };
    if (cleanData.targetMonth === undefined) delete cleanData.targetMonth;
    if (cleanData.notes === undefined) delete cleanData.notes;

    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, {
      ...cleanData,
      updatedAt: serverTimestamp(),
    });

    if (oldAmount !== newAmount) {
      const instRef = doc(db, "installments", installmentId);
      const instSnap = await getDoc(instRef);
      if (instSnap.exists()) {
        const currentTotalDue = instSnap.data().totalDue || 0;
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

export const deletePaymentRecord = async (paymentId: string, installmentId: string, amount: number) => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    const paymentSnap = await getDoc(paymentRef);
    let targetMonthToRemove = "";
    let isPenaltyRecord = false;
    
    if (paymentSnap.exists()) {
      const data = paymentSnap.data();
      targetMonthToRemove = data.targetMonth || "";
      isPenaltyRecord = data.isPenalty || false;
    }
    
    await deleteDoc(paymentRef);

    const instRef = doc(db, "installments", installmentId);
    const instSnap = await getDoc(instRef);
    
    if (instSnap.exists()) {
      const instData = instSnap.data() as InstallmentData;
      const currentTotalDue = instData.totalDue || 0;
      
      let updatedPaidMonths = instData.paidMonths || [];
      if (targetMonthToRemove) {
        updatedPaidMonths = updatedPaidMonths.filter((month: string) => month !== targetMonthToRemove);
      }

      const newTotalDue = isPenaltyRecord 
        ? Math.max(0, currentTotalDue - amount) 
        : currentTotalDue + amount;

      await updateDoc(instRef, { 
        totalDue: newTotalDue,
        paidMonths: updatedPaidMonths 
      });
    }
    return true;
  } catch (error) {
    console.error("خطأ في حذف الدفعة/الغرامة:", error);
    throw error;
  }
};

export const addPenaltyRecord = async (
  installmentId: string,
  userId: string,
  amount: number,
  notes: string
) => {
  try {
    const docRef = await addDoc(collection(db, "payments"), {
      installmentId,
      userId,
      amount,
      notes,
      isPenalty: true,
      paidAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });

    const instRef = doc(db, "installments", installmentId);
    const instSnap = await getDoc(instRef);
    if (instSnap.exists()) {
      const currentTotalDue = instSnap.data().totalDue || 0;
      await updateDoc(instRef, {
        totalDue: currentTotalDue + amount,
      });
    }
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في تسجيل الغرامة:", error);
    throw error;
  }
};

// ==========================================
// ====== 3. قسم الديون الحرة ======
// ==========================================

export const addDebt = async (debtData: Omit<DebtData, "id" | "createdAt">) => {
  try {
    const docRef = await addDoc(collection(db, "debts"), {
      ...debtData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("خطأ في إضافة الدين:", error);
    throw error;
  }
};

export const getUserDebts = async (userId: string) => {
  try {
    const q = query(
      collection(db, "debts"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DebtData[];
  } catch (error) {
    console.error("خطأ في جلب الديون:", error);
    return [];
  }
};

export const toggleDebtStatus = async (debtId: string, currentStatus: boolean) => {
  try {
    const debtRef = doc(db, "debts", debtId);
    await updateDoc(debtRef, {
      isPaid: !currentStatus
    });
    return true;
  } catch (error) {
    console.error("خطأ في تحديث حالة الدين:", error);
    throw error;
  }
};

export const deleteDebt = async (debtId: string) => {
  try {
    const debtRef = doc(db, "debts", debtId);
    await deleteDoc(debtRef);
    return true;
  } catch (error) {
    console.error("خطأ في حذف الدين:", error);
    throw error;
  }
};

// ==========================================
// ====== 4. قسم المخزن والمنتجات ======
// ==========================================

export const addInventoryItem = async (item: Omit<InventoryItem, "id">) => {
  const user = auth.currentUser;
  if (!user) throw new Error("غير مصرح - لم يتم تسجيل الدخول");

  const docRef = await addDoc(collection(db, "inventory"), {
    ...item,
    ownerUid: user.uid, // ربط المنتج بالشركة المسجلة
    status: "available",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

// ✏️ دالة تعديل مادة في المخزن
export const updateInventoryItem = async (itemId: string, updatedData: Partial<InventoryItem>) => {
  try {
    const itemRef = doc(db, "inventory", itemId);
    await updateDoc(itemRef, {
      ...updatedData,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("خطأ في تعديل المنتج:", error);
    throw error;
  }
};

// 🗑️ دالة حذف مادة من المخزن
export const deleteInventoryItem = async (itemId: string) => {
  try {
    const itemRef = doc(db, "inventory", itemId);
    await deleteDoc(itemRef);
    return true;
  } catch (error) {
    console.error("خطأ في حذف المنتج:", error);
    throw error;
  }
};

export const getAvailableInventory = async (): Promise<InventoryItem[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  const q = query(
    collection(db, "inventory"),
    where("ownerUid", "==", user.uid),
    where("status", "==", "available")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as InventoryItem));
};

export const getSoldInventory = async (): Promise<InventoryItem[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  const q = query(
    collection(db, "inventory"),
    where("ownerUid", "==", user.uid),
    where("status", "==", "sold")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as InventoryItem));
};

export const bindProductToContract = async (
  itemId: string,
  clientId: string,
  clientName: string,
  contractId: string
) => {
  const itemRef = doc(db, "inventory", itemId);
  await updateDoc(itemRef, {
    status: "sold",
    soldToClientId: clientId,
    soldToClientName: clientName,
    contractId: contractId,
    soldAt: new Date().toISOString().split("T")[0],
  });
};

export const unbindProductFromContract = async (itemId: string) => {
  try {
    const itemRef = doc(db, "inventory", itemId);
    await updateDoc(itemRef, {
      status: "available",
      soldToClientId: "",
      soldToClientName: "",
      contractId: "",
      soldAt: "",
    });
    return true;
  } catch (error) {
    console.error("خطأ في إلغاء ربط المادة وإرجاعها للمخزن:", error);
    throw error;
  }
};
// ==========================================
// 🏦 أنواع بيانات ودوال الخزينة والصندوق (Treasury)
// ==========================================

export interface TreasuryTransaction {
  id?: string;
  userId: string;
  type: "inflow" | "outflow"; // inflow: دخل/إيداع | outflow: مصاريف/سحب
  category: "installment_payment" | "down_payment" | "capital_deposit" | "inventory_purchase" | "expense" | "withdrawal";
  amount: number;
  description: string;
  date: string; // ISO String
  relatedId?: string; // رقم القسط أو العميل المربوط (اختياري)
}

// 1. إضافة حركة جديدة للخزينة
export const addTreasuryTransaction = async (transaction: Omit<TreasuryTransaction, "id">) => {
  try {
    const docRef = await addDoc(collection(db, "treasury_transactions"), {
      ...transaction,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("خطأ في إضافة حركة الخزينة:", error);
    throw error;
  }
};

// 2. جلب كافة حركات الخزينة للمستخدم
export const getUserTreasuryTransactions = async (userId: string): Promise<TreasuryTransaction[]> => {
  try {
    const q = query(
      collection(db, "treasury_transactions"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const list: TreasuryTransaction[] = [];
    querySnapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as TreasuryTransaction);
    });
    // ترتيب الحركات من الأحدث للأقدم
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error("خطأ في جلب حركات الخزينة:", error);
    return [];
  }
};

// 3. حذف حركة من الخزينة
export const deleteTreasuryTransaction = async (id: string) => {
  try {
    await deleteDoc(doc(db, "treasury_transactions", id));
  } catch (error) {
    console.error("خطأ في حذف حركة الخزينة:", error);
    throw error;
  }
};

// ==========================================
// 👥 أنواع بيانات ودوال إدارة الموظفين والصلاحيات
// ==========================================

export type UserRole = "admin" | "employee";

export interface SystemUser {
  id?: string;
  ownerUid: string; // UID المدير الأساسي مالك النظام
  name: string;
  email: string;
  username?: string; // اسم المستخدم المباشر
  password?: string; // للعرض في جدول الموظفين للمدير
  role: UserRole;
  isApproved?: boolean; // الموافقة المباشرة للحساب
  permissions: {
    canViewDashboard: boolean;
    canManageCustomers: boolean; // إضافة وتسديد عملاء
    canViewTreasury: boolean;    // الاطلاع على الخزينة والصندوق
    canManageStore: boolean;     // المخزن والمبيعات
    canDeleteOrEdit: boolean;    // تعديل وحذف الأقساط
  };
  createdAt: string;
}

// 1. إضافة موظف جديد
export const addSystemUser = async (userObj: Omit<SystemUser, "id">) => {
  try {
    const docRef = await addDoc(collection(db, "system_users"), {
      ...userObj,
      isApproved: userObj.isApproved ?? true,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("خطأ في إضافة الموظف:", error);
    throw error;
  }
};

// 2. جلب قائمة الموظفين التابعين للمدير
export const getSystemUsers = async (ownerUid: string): Promise<SystemUser[]> => {
  try {
    const q = query(
      collection(db, "system_users"),
      where("ownerUid", "==", ownerUid)
    );
    const snapshot = await getDocs(q);
    const list: SystemUser[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as SystemUser);
    });
    return list;
  } catch (error) {
    console.error("خطأ في جلب قائمة الموظفين:", error);
    return [];
  }
};

// 3. حذف موظف
export const deleteSystemUser = async (id: string) => {
  try {
    await deleteDoc(doc(db, "system_users", id));
  } catch (error) {
    console.error("خطأ في حذف الموظف:", error);
    throw error;
  }
};
// ==========================================
// ⚙️ إعدادات الطباعة ومعلومات الشركة
// ==========================================

export interface CompanySettings {
  companyName: string;
  phone: string;
  address: string;
  logoUrl?: string;
  notes?: string;
}

// 1. جلب إعدادات الشركة الخاصة بـ ownerUid
export const getCompanySettings = async (ownerUid: string): Promise<CompanySettings | null> => {
  try {
    const docRef = doc(db, "users", ownerUid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        companyName: data.companyName || "",
        phone: data.phone || "",
        address: data.address || "",
        logoUrl: data.logoUrl || "",
        notes: data.notes || "",
      };
    }
    return null;
  } catch (error) {
    console.error("خطأ في جلب إعدادات الشركة:", error);
    return null;
  }
};

// 2. حفظ / تحديث إعدادات الشركة الخاصة بـ ownerUid
export const saveCompanySettings = async (ownerUid: string, settings: CompanySettings) => {
  try {
    const docRef = doc(db, "users", ownerUid);
    await updateDoc(docRef, {
      companyName: settings.companyName,
      phone: settings.phone,
      address: settings.address,
      logoUrl: settings.logoUrl || "",
      notes: settings.notes || "",
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("خطأ في حفظ إعدادات الشركة:", error);
    throw error;
  }
};

// 🧹 دالة مسح كافة حركات الخزينة والدفعات الخاصة بالحساب الحالي
export const clearUserTreasuryData = async (ownerUid: string) => {
  try {
    // 1. جلب وحذف حركات الخزينة اليدوية
    const qTreasury = query(
      collection(db, "treasury_transactions"),
      where("userId", "==", ownerUid)
    );
    const treasurySnap = await getDocs(qTreasury);
    const deleteTreasuryPromises = treasurySnap.docs.map((docSnap) =>
      deleteDoc(doc(db, "treasury_transactions", docSnap.id))
    );

    // 2. جلب وحذف سجلات الدفعات المقبوضة
    const qPayments = query(
      collection(db, "payments"),
      where("userId", "==", ownerUid)
    );
    const paymentsSnap = await getDocs(qPayments);
    const deletePaymentsPromises = paymentsSnap.docs.map((docSnap) =>
      deleteDoc(doc(db, "payments", docSnap.id))
    );

    await Promise.all([...deleteTreasuryPromises, ...deletePaymentsPromises]);
    return true;
  } catch (error) {
    console.error("خطأ في مسح حركات الخزينة والدفعات:", error);
    throw error;
  }
};