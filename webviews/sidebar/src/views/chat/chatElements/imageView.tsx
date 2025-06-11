import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Download, Trash2, CheckCircle, X } from 'lucide-react';
import { deleteImage, downloadImageFile, logToOutput } from '@/commandApi';

export const ImageWithDownload = ({
  src,
  alt,
  Key,
  thumbnail = false,
  onClick,
}: {
  src: string;
  alt: string;
  Key?: string;
  thumbnail?: boolean;
  onClick?: () => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [deleteDialogPosition, setDeleteDialogPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

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
        }, 1100);
      } else {
        setShowMenu(false);
      }
    } catch (error) {
      logToOutput('error', `Error downloading image: ${error}`);
    }
    setIsDownloading(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
    setShowMenu(false);
  };

  const updateMenuPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 120;
      const menuHeight = 70;
      
      let left = rect.right - menuWidth;
      let top = rect.bottom + 4;
      
      // Ensures menu doesn't go off the left edge of screen
      if (left < 10) {
        left = 10;
      }
      if (top + menuHeight > window.innerHeight - 10) {
        top = rect.top - menuHeight - 4;
      }
      
      setMenuPosition({ top, left });
    }
  };

  const updateDeleteDialogPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isSmallScreen = window.innerWidth < 480;
      const dialogWidth = isSmallScreen ? 150 : 180;
      const dialogHeight = 80;
      
      let left = rect.right - dialogWidth;
      let top = rect.bottom + 4;
    
      if (left < 10) {
        left = 10;
      }
      if (top + dialogHeight > window.innerHeight - 10) {
        top = rect.top - dialogHeight - 4;
      }
      
      setDeleteDialogPosition({ top, left });
    }
  };


  const handleDelete = async () => {
    if (!Key) return;

    try {
      const data = await deleteImage(Key);
      setIsDeleted(true);
    } catch (error) {
      logToOutput('error', `Error deleting image: ${error}`);
    }
    setShowDeleteConfirmation(false);
    setShowMenu(false);
  };

  const handleImageClick = () => {
    if ((thumbnail || onClick) && Key) {
      onClick ? onClick() : setShowModal(true);
    }
  };

  // Update menu position when showMenu or showDeleteConfirmation changes
  useEffect(() => {
    if (showMenu || showDeleteConfirmation) {
      updateMenuPosition();
      
      const handleResize = () => updateMenuPosition();
      const handleScroll = () => updateMenuPosition();
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true); // Used capture phase to catch all scroll events
      document.addEventListener('scroll', handleScroll, true);
      
      const scrollableParents: HTMLElement[] = [];
      let parent = buttonRef.current?.parentElement;
      while (parent && parent !== document.body) {
        if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
          scrollableParents.push(parent);
          parent.addEventListener('scroll', handleScroll);
        }
        parent = parent.parentElement;
      }
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
        document.removeEventListener('scroll', handleScroll, true);
        scrollableParents.forEach(p => p.removeEventListener('scroll', handleScroll));
      };
    }
  }, [showMenu, showDeleteConfirmation]);

  useEffect(() => {
    if (showDeleteConfirmation) {
      updateDeleteDialogPosition();
      
      const handleResize = () => updateDeleteDialogPosition();
      const handleScroll = () => updateDeleteDialogPosition();
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      document.addEventListener('scroll', handleScroll, true);
      
      const scrollableParents: HTMLElement[] = [];
      let parent = buttonRef.current?.parentElement;
      while (parent && parent !== document.body) {
        if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
          scrollableParents.push(parent);
          parent.addEventListener('scroll', handleScroll);
        }
        parent = parent.parentElement;
      }
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
        document.removeEventListener('scroll', handleScroll, true);
        scrollableParents.forEach(p => p.removeEventListener('scroll', handleScroll));
      };
    }
  }, [showDeleteConfirmation]);

  // Don't render if image is deleted
  if (isDeleted) {
    return null;
  }

  return (
    <div className={`relative ${thumbnail ? 'flex-shrink-0' : 'inline-block'}`}>
      <img
        src={src}
        alt={alt}
        className={`rounded-md border ${
          thumbnail 
            ? 'h-16 w-auto min-w-[60px] max-w-[100px] object-cover cursor-pointer hover:opacity-80 transition-opacity sm:h-20 sm:max-w-[120px]'
            : 'my-2 max-w-full'
        }`}
        style={{
          borderColor: 'var(--vscode-editorWidget-border)',
        }}
        onClick={handleImageClick}
      />
      {Key && (
        <div className={`absolute ${thumbnail ? 'right-0.5 top-0.5' : 'right-1 top-3.5'}`}>
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setShowMenu(!showMenu)}
              className={`flex items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 ${
                thumbnail ? 'h-5 w-5' : 'h-6 w-6'
              }`}
              title="More options"
            >
              <MoreVertical size={thumbnail ? 12 : 14} />
            </button>
          </div>
        </div>
      )}

      {/* Dropdown Menu */}
      {showMenu && createPortal(
        <div
          className={`fixed z-[99999] min-w-[120px] max-w-[200px] rounded-md border bg-white shadow-lg ${
            thumbnail ? 'text-xs' : ''
          }`}
          style={{
            backgroundColor: 'var(--vscode-dropdown-background)',
            borderColor: 'var(--vscode-dropdown-border)',
            color: 'var(--vscode-dropdown-foreground)',
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          <button
            onClick={handleDownload}
            className={`flex w-full items-center gap-2 text-left transition-colors hover:bg-gray-100 disabled:opacity-50 ${
              thumbnail ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
            }`}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            disabled={isDownloading}
          >
            {downloadComplete ? (
              <CheckCircle size={thumbnail ? 12 : 14} className="text-green-500" />
            ) : (
              <Download size={thumbnail ? 12 : 14} />
            )}
            {isDownloading ? 'Downloading...' : downloadComplete ? 'Downloaded' : 'Download'}
          </button>
          <button
            onClick={handleDeleteClick}
            className={`flex w-full items-center gap-2 text-left text-red-400 transition-colors hover:bg-gray-700 ${
              thumbnail ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
            }`}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={thumbnail ? 12 : 14} />
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && createPortal(
        <div
          className={`fixed z-[99999] rounded-md border shadow-lg w-auto ${
            thumbnail ? 'p-2' : 'p-3'
          }`}
          style={{
            backgroundColor: 'var(--vscode-editorHoverWidget-background)',
            borderColor: 'var(--vscode-editorHoverWidget-border)',
            color: 'var(--vscode-editorHoverWidget-foreground)',
            maxWidth: window.innerWidth < 480 ? '160px' : '200px',
            minWidth: window.innerWidth < 480 ? '140px' : '180px',
            width: window.innerWidth < 480 ? '150px' : '180px',
            top: `${deleteDialogPosition.top}px`,
            left: `${deleteDialogPosition.left}px`,
          }}
        >
          <p className={`${thumbnail ? 'mb-2 text-xs' : 'mb-3 text-sm'}`} style={{ color: 'var(--vscode-editorHoverWidget-foreground)' }}>
            Are you sure you want to delete this image?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowDeleteConfirmation(false)}
              className={`rounded-md ${thumbnail ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'}`}
              style={{
                color: 'var(--vscode-button-secondaryForeground)',
                backgroundColor: 'var(--vscode-button-secondaryBackground)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
              }}
            >
              No
            </button>
            <button
              onClick={handleDelete}
              className={`rounded-md ${thumbnail ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'}`}
              style={{
                color: 'var(--vscode-button-foreground)',
                backgroundColor: 'var(--vscode-button-background)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
              }}
            >
              Yes
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Backdrop for delete confirmation */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 z-[99998]" onClick={() => setShowDeleteConfirmation(false)} />
      )}

      {/* Backdrop for menu */}
      {showMenu && <div className="fixed inset-0 z-[99998]" onClick={() => setShowMenu(false)} />}

      {/* Image Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-2">
          <div className="relative max-h-full max-w-full">
            <button
              onClick={() => setShowModal(false)}
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors z-10"
              title="Close"
            >
              <X size={16} />
            </button>
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              style={{
                maxHeight: 'calc(100vh - 60px)',
                maxWidth: 'calc(100vw - 20px)',
              }}
            />
          </div>
          <div className="absolute inset-0" onClick={() => setShowModal(false)} />
        </div>
      )}
    </div>
  );
};