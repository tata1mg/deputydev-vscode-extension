import { useState } from 'react';
import { MoreVertical, Download, Trash2, CheckCircle} from 'lucide-react';
import { deleteImage, downloadImageFile } from '@/commandApi';


export const ImageWithDownload = ({ src, alt, Key }: { src: string; alt: string; Key?: string }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);

  const handleDownload = async () => {
    if (!Key) return;

    setIsDownloading(true);
    setDownloadComplete(false);
    try {
      const result = await downloadImageFile(Key);
      if (result?.success) {
        setDownloadComplete(true);
        setTimeout(() => {
          setDownloadComplete(false);
          setShowMenu(false);
        }, 1500);
      }
      else{
        setShowMenu(false);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
    setIsDownloading(false);
  };

  const handleDelete = async () => {
    if (!Key) return;

    try {
      const data = await deleteImage(Key);
      setIsDeleted(true);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
    setShowMenu(false);
  };

  // Don't render if image is deleted
  if (isDeleted) {
    return null;
  }

  return (
    <div className="relative inline-block">
      <img
        src={src}
        alt={alt}
        className="my-2 max-w-full rounded-md border"
        style={{
          borderColor: 'var(--vscode-editorWidget-border)',
        }}
      />
      {Key && (
        <div className="absolute top-2 right-2">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              title="More options"
            >
              <MoreVertical size={14} />
            </button>
            {showMenu && (
              <div
                className="absolute right-0 top-full mt-1 min-w-[120px] rounded-md border bg-white shadow-lg z-10"
                style={{
                  backgroundColor: 'var(--vscode-dropdown-background)',
                  borderColor: 'var(--vscode-dropdown-border)',
                  color: 'var(--vscode-dropdown-foreground)',
                }}
              >
                <button
                  onClick={handleDownload}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  disabled={isDownloading}
                >
                  {downloadComplete ? (
                    <CheckCircle size={14} className="text-green-500" />
                  ) : (
                    <Download size={14} />
                  )}
                  {isDownloading ? 'Downloading...' : 'Download'}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};
