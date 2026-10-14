import CustomerDetailsClient from "./CustomerDetailsClient";

export async function generateStaticParams() {
  return [{ id: "1" }];
}

export default function CustomerPage() {
  return <CustomerDetailsClient />;
}