/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef } from "react";
import { UseFormRegister, UseFormSetValue } from "react-hook-form";
import {
  FormLabel,
  Input,
  InputLeftAddon,
  FormHelperText,
  InputGroup,
  FormControl,
  FormErrorMessage,
  Divider,
} from "@chakra-ui/react";
import Carousel from "../../Carousel";

interface TextPropsType {
  register: UseFormRegister<any>;
  name: string;
  placeHolder?: string;
  label: string;
  defaultValue?: any;
  errorMsg?: any;
  leftAddon?: string;
  helperText?: string;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  onSelectValidation?: (file: File) => Promise<boolean>;
  setValueFormState: UseFormSetValue<any>;
}

function FileSelector({
  register,
  name,
  placeHolder,
  label,
  defaultValue = [],
  errorMsg,
  leftAddon,
  helperText,
  multiple = false,
  accept = ".png,.jpg,.jpeg",
  maxFiles = 1,
  onSelectValidation,
  setValueFormState,
}: TextPropsType) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [, setValue] = useState<FileList | File | null>(() => {
    setValueFormState(name, defaultValue);
    return defaultValue;
  });

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) {
      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/")
      );
      const imageUrls = imageFiles.map((file) => URL.createObjectURL(file));
      setImagePreviews(imageUrls);

      // If multiple files are selected, limit the number of files to maxFiles
      if (multiple && maxFiles > 1 && files.length > maxFiles) {
        const selectedFiles = Array.from(files).slice(0, maxFiles).reverse();
        const dataTransfer = new DataTransfer();
        selectedFiles.forEach((file) => dataTransfer.items.add(file));
        fileInputRef.current!.files = dataTransfer.files;
        setValue(dataTransfer.files);
        setValueFormState(name, dataTransfer.files);

        console.log(name, selectedFiles);
        return;
      }

      const selectedFile = files[0];
      if (onSelectValidation && !(await onSelectValidation(selectedFile))) {
        return;
      }
      setValue(selectedFile);
      setValueFormState(name, selectedFile);
      console.log(name, selectedFile);
    }
  }

  return (
    <>
      <FormControl isInvalid={errorMsg?.message !== undefined}>
        <FormLabel htmlFor={name}>{label}</FormLabel>
        <InputGroup
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {leftAddon && <InputLeftAddon>{leftAddon}</InputLeftAddon>}
          <Input
            {...register(name)}
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            id={name}
            placeholder={placeHolder}
            onChange={handleChange}
            max={3}
            accept={accept}
            height={"50px"}
          />
        </InputGroup>
        {!errorMsg ? (
          <FormHelperText>{helperText}</FormHelperText>
        ) : (
          <FormErrorMessage>{errorMsg?.message}</FormErrorMessage>
        )}
      </FormControl>

      {imagePreviews && imagePreviews.length > 0 && (
        <>
          <Divider />
          <Carousel
            cards={imagePreviews?.map((screenshot: any) => ({
              image: screenshot,
            }))}
            autoplay={false}
          />
        </>
      )}
    </>
  );
}

export default FileSelector;
