import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم إرسال بيانات الصورة" }, { status: 400 });
    }

    const formData = new FormData();
    const formattedBase64 = imageBase64.startsWith("data:") 
      ? imageBase64 
      : `data:image/jpeg;base64,${imageBase64}`;

    formData.append("base64Image", formattedBase64);
    formData.append("OCREngine", "2"); // يتعرف تلقائياً على العربية والإنجليزية والأرقام
    formData.append("scale", "true");

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: "K88888888888957",
      },
      body: formData,
    });

    const data = await response.json();

    if (data.IsErroredOnProcessing) {
      return NextResponse.json(
        { error: data.ErrorMessage?.[0] || "فشل تحليل الصورة" },
        { status: 500 }
      );
    }

    const fullText = data.ParsedResults?.[0]?.ParsedText || "";
    return NextResponse.json({ text: fullText });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "حدث خطأ في السيرفر" },
      { status: 500 }
    );
  }
}