import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      duration={4000}
      className="toaster group"
      toastOptions={{
        className:
          "!w-[min(92vw,42rem)] !rounded-2xl !border !border-white/25 !bg-black !px-6 !py-5 !text-base !font-bold !text-white !shadow-2xl !shadow-black/70 sm:!text-lg",
      }}
      style={
        {
          "--normal-bg": "#000000",
          "--normal-text": "#ffffff",
          "--normal-border": "rgba(255, 255, 255, 0.3)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
