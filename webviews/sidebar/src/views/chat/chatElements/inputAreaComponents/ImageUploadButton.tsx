import { uploadFileToS3 } from '@/commandApi';
import { useLLMModelStore } from '@/stores/llmModelStore';
import { Image } from 'lucide-react';
import React from 'react';

type ImageUploadButtonProps = {
  imagePreviews: string[];
  setImagePreviews: (previews: string[]) => void;
  maxFiles: number;
  maxSize: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
};

const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({
  imagePreviews,
  setImagePreviews,
  maxFiles,
  maxSize,
  fileInputRef,
}) => {
  const { activeModel } = useLLMModelStore();
  const isMultimodal = activeModel?.multimodal;
  const isDisabled = !isMultimodal || imagePreviews.length >= maxFiles;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!isMultimodal) return; // Prevent upload if not multimodal

    if (files.length > 0) {
      const currentCount = imagePreviews.length;
      const availableSlots = maxFiles - currentCount;

      if (availableSlots <= 0) {
        // Optional: show error UI here
        return;
      }

      const filesToProcess = files.slice(0, availableSlots);

      // Check file sizes
      const oversizedFiles = filesToProcess.filter((file) => file.size > maxSize);
      if (oversizedFiles.length > 0) {
        // Optional: show error UI here
        return;
      }

      // Create previews for all valid files
      const newPreviews: string[] = [];
      filesToProcess.forEach((file) => {
        const previewUrl = URL.createObjectURL(file);
        newPreviews.push(previewUrl);
      });

      setImagePreviews([...imagePreviews, ...newPreviews]);

      // Upload all files
      filesToProcess.forEach((file) => {
        uploadFileToS3(file);
      });
    }
  };

  // Tooltip logic
  let tooltipText = '';
  if (!isMultimodal) {
    tooltipText = 'The selected model does not support image uploads.';
  } else if (imagePreviews.length >= maxFiles) {
    tooltipText = `Maximum ${maxFiles} images allowed`;
  } else {
    tooltipText = `Upload Images (${imagePreviews.length}/${maxFiles})`;
  }

  return (
    <>
      <input
        type="file"
        accept="image/*"
        multiple
        id="image-upload"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={isDisabled}
      />

      <label
        htmlFor="image-upload"
        className={`flex items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10 ${
          isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        }`}
        data-tooltip-id="upload-tooltip"
        data-tooltip-content={tooltipText}
        data-tooltip-place="top-start"
        aria-disabled={isDisabled}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
          }
        }}
      >
        <Image className="h-4 w-4" />
      </label>
    </>
  );
};

export default ImageUploadButton;
