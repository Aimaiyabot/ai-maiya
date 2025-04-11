"use client";

type Props = {
  url: string;
};

export default function DownloadButton({ url }: Props) {
  const handleDownload = () => {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", "maiya-art.png");
      a.setAttribute("target", "_blank"); // open in new tab fallback
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download fallback failed:", error);
      alert("Oops! Couldn't download the image. Try right-clicking and saving instead.");
    }
  };

  if (!url) return null;

  return (
    <button
      onClick={handleDownload}
      className="mt-2 text-xs bg-pink-100 hover:bg-pink-200 text-pink-700 px-3 py-1 rounded-full shadow inline-block"
    >
      💾 Download Image
    </button>
  );
}
