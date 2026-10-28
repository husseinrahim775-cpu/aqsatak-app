import { db, auth } from "./firebase";
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
  deleteDoc,
  getDocsFromCache
} from "firebase/firestore";

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
  months: number; 
  paymentPeriod?: "daily" | "weekly" | "monthly"; 
  totalDue: number;
  totalProfit: number;
  monthlyInstallment: number; 
  startDate?: string;
  nextDueDate?: string;
  isBlacklisted?: boolean;
  blacklistReason?: string;
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
  ownerUid?: string;          
  title: string;          
  category: string;       
  price: number;   
  costPrice?: number;     
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

export interface CustomerRiskStatus {
  level: "excellent" | "warning" | "danger";
  label: string;
  color: string;
  isBlacklisted: boolean;
  maxDaysOverdue: number;
}

// Helper لتسهيل القراءة السريعة من الـ Cache
const fetchWithCacheFirst = async (q: any) => {
  try {
    const cacheSnap = await getDocsFromCache(q);
    if (!cacheSnap.empty) {
      return cacheSnap;
    }
  } catch (e) {
    // الكاش غير متوفر
  }
  return await getDocs(q);
};

// ==========================================
// ====== ☁️ دالة الرفع السلس والتلقائي لـ Google Drive ======
// ==========================================

export const triggerSilentDriveBackup = async (ownerUid: string) => {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("google_drive_access_token");
  if (!token || !ownerUid) return;

  try {
    const [installments, payments, treasury_transactions, inventory] = await Promise.all([
      getUserInstallments(ownerUid).catch(() => []),
      getUserPayments(ownerUid).catch(() => []),
      getUserTreasuryTransactions(ownerUid).catch(() => []),
      getAvailableInventory().catch(() => []),
    ]);

    const backupData = {
      exportDate: new Date().toISOString(),
      userId: ownerUid,
      installments,
      payments,
      treasury_transactions,
      inventory,
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayDateStr = `${year}-${month}-${day}`;

    const fileName = `aqsatk_backup_${todayDateStr}.json`;
    const fileContent = JSON.stringify(backupData, null, 2);

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}'+and+trashed=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    let existingFileId = null;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
      }
    }

    if (existingFileId) {
      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: fileContent,
        }
      );
    } else {
      const metadata = { name: fileName, mimeType: "application/json" };
      const formData = new FormData();
      formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      formData.append("file", new Blob([fileContent], { type: "application/json" }));

      await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    }

    localStorage.setItem("last_auto_drive_backup_date", todayDateStr);
  } catch (error) {
    console.warn("تنبيه: تعذر الرفع التلقائي خلف الكواليس لـ Google Drive:", error);
  }
};

// ==========================================
// ====== 📸 0. تحويل وضغط الصور مجاناً (Base64) ======
// ==========================================

export const compressAndConvertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800; // أبعاد واضحة ومناسبة للوثائق

        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // ضغط الجودة لـ 60% لضمان حجم خفيف جداً بـ Firestore
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);
        resolve(compressedBase64);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * 📸 تحديث أو حذف صور المستندات لعقد محدد
 */
export const updateContractDocuments = async (
  installmentId: string,
  updatedDocuments: {
    idCardUrl?: string;
    contractUrl?: string;
    personalPhotoUrl?: string;
  }
) => {
  try {
    const instRef = doc(db, "installments", installmentId);
    await updateDoc(instRef, {
      documents: updatedDocuments,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error("خطأ في تحديث صور المستندات:", error);
    throw error;
  }
};

// ==========================================
// ====== 🚦 1. نظام التقييم والحظر الآلي (V14 Engine) ======
// ==========================================

export const calculateCustomerRisk = (
  installments: InstallmentData[],
  payments: PaymentRecord[],
  isManualBlacklisted: boolean = false,
  blacklistReason?: string
): CustomerRiskStatus => {
  if (isManualBlacklisted || installments.some((i) => i.isBlacklisted)) {
    return {
      level: "danger",
      label: "🔴 محظور (القائمة السوداء)",
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold",
      isBlacklisted: true,
      maxDaysOverdue: 999,
    };
  }

  const now = new Date();
  let maxDaysOverdue = 0;

  installments.forEach((inst) => {
    const instPayments = payments.filter((p) => p.installmentId === inst.id);
    const paidSum = instPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remaining = Number(inst.totalDue || 0) - paidSum;

    if (remaining > 0 && inst.nextDueDate) {
      const dueDate = new Date(inst.nextDueDate);
      if (now > dueDate) {
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays > maxDaysOverdue) maxDaysOverdue = diffDays;
      }
    }
  });

  if (maxDaysOverdue > 30) {
    return {
      level: "danger",
      label: `🔴 عميل خطر (متأخر ${maxDaysOverdue} يوم)`,
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold",
      isBlacklisted: false,
      maxDaysOverdue,
    };
  } else if (maxDaysOverdue > 5) {
    return {
      level: "warning",
      label: `🟡 عميل متلكئ (متأخر ${maxDaysOverdue} أيام)`,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold",
      isBlacklisted: false,
      maxDaysOverdue,
    };
  }

  return {
    level: "excellent",
    label: "🟢 عميل ممتاز (التزام تام)",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold",
    isBlacklisted: false,
    maxDaysOverdue: 0,
  };
};

export const toggleCustomerBlacklist = async (
  userId: string,
  phoneNumber: string,
  isBlacklisted: boolean,
  reason?: string
) => {
  try {
    const installments = await getInstallmentsByPhone(userId, phoneNumber);
    const updatePromises = installments.map((inst) => {
      if (!inst.id) return Promise.resolve();
      const instRef = doc(db, "installments", inst.id);
      return updateDoc(instRef, {
        isBlacklisted,
        blacklistReason: reason || "",
        updatedAt: serverTimestamp(),
      });
    });

    await Promise.all(updatePromises);
    triggerSilentDriveBackup(userId);
    return true;
  } catch (error) {
    console.error("خطأ في تحديث القائمة السوداء:", error);
    throw error;
  }
};

export const checkCustomerBlacklistStatus = async (userId: string, phoneNumber: string) => {
  try {
    const installments = await getInstallmentsByPhone(userId, phoneNumber);
    const isBlacklisted = installments.some((i) => i.isBlacklisted);
    const blacklistReason = installments.find((i) => i.isBlacklisted)?.blacklistReason || "";

    return {
      isBlacklisted,
      blacklistReason,
      previousContractsCount: installments.length,
    };
  } catch (error) {
    console.error("خطأ في فحص القائمة السوداء للعميل:", error);
    return { isBlacklisted: false, blacklistReason: "", previousContractsCount: 0 };
  }
};

// ==========================================
// ====== 2. إدارة الأقساط والعملاء ======
// ==========================================

export const addInstallmentRecord = async (data: Omit<InstallmentData, "id" | "createdAt">) => {
  try {
    const docRef = await addDoc(collection(db, "installments"), {
      ...data,
      paidMonths: [],
      isBlacklisted: data.isBlacklisted || false,
      createdAt: serverTimestamp(),
    });

    triggerSilentDriveBackup(data.userId);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في حفظ القسط:", error);
    return { success: false, id: null, error };
  }
};

export const getUserInstallments = async (userId: string) => {
  try {
    const q = query(collection(db, "installments"), where("userId", "==", userId));
    const querySnapshot = await fetchWithCacheFirst(q);
    const installments: InstallmentData[] = [];
    
    querySnapshot.forEach((docSnap: any) => {
      installments.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as InstallmentData);
    });
    
    return installments;
  } catch (error) {
    console.error("خطأ في جلب بيانات الأقساط:", error);
    return [];
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

    if (updatedData.userId) triggerSilentDriveBackup(updatedData.userId);
    return true;
  } catch (error) {
    console.error("خطأ في تحديث بيانات العميل/القسط:", error);
    throw error;
  }
};

export const deleteInstallment = async (installmentId: string) => {
  try {
    const q = query(
      collection(db, "inventory"), 
      where("contractId", "==", installmentId)
    );
    const querySnapshot = await getDocs(q);

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

    const docRef = doc(db, "installments", installmentId);
    const docSnap = await getDoc(docRef);
    const userId = docSnap.exists() ? docSnap.data().userId : null;

    await deleteDoc(docRef);

    if (userId) triggerSilentDriveBackup(userId);
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
    const querySnapshot = await fetchWithCacheFirst(q);
    const list: InstallmentData[] = [];
    querySnapshot.forEach((doc: any) => {
      list.push({ id: doc.id, ...doc.data() } as InstallmentData);
    });
    return list;
  } catch (error) {
    console.error("خطأ في جلب أقساط العميل:", error);
    return [];
  }
};

// ==========================================
// ====== 3. سجل المقبوضات والدفعات ======
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

    triggerSilentDriveBackup(data.userId);
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
    const querySnapshot = await fetchWithCacheFirst(q);
    const payments: PaymentRecord[] = [];
    querySnapshot.forEach((docSnap: any) => {
      payments.push({ id: docSnap.id, ...docSnap.data() } as PaymentRecord);
    });
    return payments;
  } catch (error) {
    console.error("خطأ في جلب السجلات:", error);
    return [];
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

    if (updatedData.userId) triggerSilentDriveBackup(updatedData.userId);
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
    let userId = "";
    
    if (paymentSnap.exists()) {
      const data = paymentSnap.data();
      targetMonthToRemove = data.targetMonth || "";
      isPenaltyRecord = data.isPenalty || false;
      userId = data.userId || "";
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

    if (userId) triggerSilentDriveBackup(userId);
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

    triggerSilentDriveBackup(userId);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("خطأ في تسجيل الغرامة:", error);
    throw error;
  }
};

// ==========================================
// ====== 4. قسم الديون الحرة ======
// ==========================================

export const addDebt = async (debtData: Omit<DebtData, "id" | "createdAt">) => {
  try {
    const docRef = await addDoc(collection(db, "debts"), {
      ...debtData,
      createdAt: serverTimestamp(),
    });

    triggerSilentDriveBackup(debtData.userId);
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
    const querySnapshot = await fetchWithCacheFirst(q);
    return querySnapshot.docs.map((doc: any) => ({
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

    const debtSnap = await getDoc(debtRef);
    if (debtSnap.exists() && debtSnap.data().userId) {
      triggerSilentDriveBackup(debtSnap.data().userId);
    }
    return true;
  } catch (error) {
    console.error("خطأ في تحديث حالة الدين:", error);
    throw error;
  }
};

export const deleteDebt = async (debtId: string) => {
  try {
    const debtRef = doc(db, "debts", debtId);
    const debtSnap = await getDoc(debtRef);
    const userId = debtSnap.exists() ? debtSnap.data().userId : null;

    await deleteDoc(debtRef);

    if (userId) triggerSilentDriveBackup(userId);
    return true;
  } catch (error) {
    console.error("خطأ في حذف الدين:", error);
    throw error;
  }
};

// ==========================================
// ====== 5. قسم المخزن والمنتجات ======
// ==========================================

export const addInventoryItem = async (item: Omit<InventoryItem, "id">) => {
  const user = auth.currentUser;
  if (!user) throw new Error("غير مصرح - لم يتم تسجيل الدخول");

  const docRef = await addDoc(collection(db, "inventory"), {
    ...item,
    ownerUid: user.uid, 
    status: "available",
    createdAt: serverTimestamp(),
  });

  triggerSilentDriveBackup(user.uid);
  return docRef.id;
};

export const updateInventoryItem = async (itemId: string, updatedData: Partial<InventoryItem>) => {
  try {
    const itemRef = doc(db, "inventory", itemId);
    await updateDoc(itemRef, {
      ...updatedData,
      updatedAt: serverTimestamp(),
    });

    const user = auth.currentUser;
    if (user) triggerSilentDriveBackup(user.uid);
    return true;
  } catch (error) {
    console.error("خطأ في تعديل المنتج:", error);
    throw error;
  }
};

export const deleteInventoryItem = async (itemId: string) => {
  try {
    const itemRef = doc(db, "inventory", itemId);
    await deleteDoc(itemRef);

    const user = auth.currentUser;
    if (user) triggerSilentDriveBackup(user.uid);
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
  const snapshot = await fetchWithCacheFirst(q);
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as InventoryItem));
};

export const getSoldInventory = async (): Promise<InventoryItem[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  const q = query(
    collection(db, "inventory"),
    where("ownerUid", "==", user.uid),
    where("status", "==", "sold")
  );
  const snapshot = await fetchWithCacheFirst(q);
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as InventoryItem));
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

  const user = auth.currentUser;
  if (user) triggerSilentDriveBackup(user.uid);
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

    const user = auth.currentUser;
    if (user) triggerSilentDriveBackup(user.uid);
    return true;
  } catch (error) {
    console.error("خطأ في إلغاء ربط المادة وإرجاعها للمخزن:", error);
    throw error;
  }
};

// ==========================================
// 🏦 6. الخزينة والصندوق (Treasury)
// ==========================================

export interface TreasuryTransaction {
  id?: string;
  userId: string;
  type: "inflow" | "outflow"; 
  category: "installment_payment" | "down_payment" | "capital_deposit" | "inventory_purchase" | "expense" | "withdrawal";
  amount: number;
  description: string;
  date: string; 
  relatedId?: string; 
}

export const addTreasuryTransaction = async (transaction: Omit<TreasuryTransaction, "id">) => {
  try {
    const docRef = await addDoc(collection(db, "treasury_transactions"), {
      ...transaction,
      createdAt: new Date().toISOString(),
    });

    triggerSilentDriveBackup(transaction.userId);
    return docRef.id;
  } catch (error) {
    console.error("خطأ في إضافة حركة الخزينة:", error);
    throw error;
  }
};

export const getUserTreasuryTransactions = async (userId: string): Promise<TreasuryTransaction[]> => {
  try {
    const q = query(
      collection(db, "treasury_transactions"),
      where("userId", "==", userId)
    );
    const querySnapshot = await fetchWithCacheFirst(q);
    const list: TreasuryTransaction[] = [];
    querySnapshot.forEach((doc: any) => {
      list.push({ id: doc.id, ...doc.data() } as TreasuryTransaction);
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error("خطأ في جلب حركات الخزينة:", error);
    return [];
  }
};

export const deleteTreasuryTransaction = async (id: string) => {
  try {
    const txRef = doc(db, "treasury_transactions", id);
    const txSnap = await getDoc(txRef);
    const userId = txSnap.exists() ? txSnap.data().userId : null;

    await deleteDoc(txRef);

    if (userId) triggerSilentDriveBackup(userId);
  } catch (error) {
    console.error("خطأ في حذف حركة الخزينة:", error);
    throw error;
  }
};

// ==========================================
// 👥 7. الموظفين والصلاحيات
// ==========================================

export type UserRole = "admin" | "employee";

export interface SystemUser {
  id?: string;
  ownerUid: string; 
  name: string;
  email: string;
  username?: string; 
  password?: string; 
  role: UserRole;
  isApproved?: boolean; 
  permissions: {
    canViewDashboard: boolean;
    canManageCustomers: boolean; 
    canViewTreasury: boolean;    
    canManageStore: boolean;     
    canDeleteOrEdit: boolean;    
  };
  createdAt: string;
}

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

export const getSystemUsers = async (ownerUid: string): Promise<SystemUser[]> => {
  try {
    const q = query(
      collection(db, "system_users"),
      where("ownerUid", "==", ownerUid)
    );
    const snapshot = await fetchWithCacheFirst(q);
    const list: SystemUser[] = [];
    snapshot.forEach((docSnap: any) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as SystemUser);
    });
    return list;
  } catch (error) {
    console.error("خطأ في جلب قائمة الموظفين:", error);
    return [];
  }
};

export const deleteSystemUser = async (id: string) => {
  try {
    await deleteDoc(doc(db, "system_users", id));
  } catch (error) {
    console.error("خطأ في حذف الموظف:", error);
    throw error;
  }
};

// ==========================================
// ⚙️ 8. إعدادات الطباعة ومعلومات الشركة
// ==========================================

export interface CompanySettings {
  companyName: string;
  phone: string;
  address: string;
  logoUrl?: string;
  notes?: string;
}

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

/**
 * 🛡️ دالة آمنة ومعدلة لتصفير الخزينة والصندوق فقط
 * تم حمايتها لمنع مسح سجل دفعات العملاء (payments) تماماً لتفادي تصفير الحسابات والتقارير.
 */
export const clearUserTreasuryData = async (ownerUid: string) => {
  try {
    const qTreasury = query(
      collection(db, "treasury_transactions"),
      where("userId", "==", ownerUid)
    );
    const treasurySnap = await getDocs(qTreasury);
    const deleteTreasuryPromises = treasurySnap.docs.map((docSnap) =>
      deleteDoc(doc(db, "treasury_transactions", docSnap.id))
    );

    await Promise.all(deleteTreasuryPromises);
    triggerSilentDriveBackup(ownerUid);
    return true;
  } catch (error) {
    console.error("خطأ في مسح حركات الخزينة اليدوية:", error);
    throw error;
  }
};