export const metadata = {
  title: "HH AI MVP",
  description: "AI assistant for HH applications",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
