import './globals.css';

export const metadata = {
  title: 'Locum Planner',
  description: 'Book and advertise pharmacy locum shifts — fast.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
