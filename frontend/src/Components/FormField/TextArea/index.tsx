
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { UseFormRegister, FieldError, UseFormSetValue } from "react-hook-form";
import { FormLabel, Textarea, FormHelperText, InputGroup, FormControl, FormErrorMessage } from "@chakra-ui/react";

interface TextPropsType {
  register: UseFormRegister<any>;
  name: string;
  placeHolder?: string;
  label: string;
  defaultValue?: string;
  errorMsg?: FieldError;
  helperText?: string;
  setValueFormState: UseFormSetValue<any>;
}

function TextArea({
  register,
  name,
  placeHolder,
  label,
  defaultValue,
  errorMsg,
  helperText,
  setValueFormState
}: TextPropsType) {
  const [value, setValue] = useState(() => {
    setValueFormState(name, defaultValue ?? '');
    return defaultValue ?? '';
  });

  async function handleChange(e: any) {
    const newValue: any = e.target.value;
    setValue(newValue);
    setValueFormState(name, newValue);
    console.log(name, newValue);
  }

  return (
    <FormControl isInvalid={errorMsg?.message !== undefined}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <InputGroup>
        <Textarea
          {...register(name)}
          id={name}
          value={value}
          onChange={handleChange}
          placeholder={placeHolder}
        />
      </InputGroup>
      {!errorMsg ? (
        <FormHelperText>
          {helperText}
        </FormHelperText>
      ) : (
        <FormErrorMessage>{errorMsg?.message}</FormErrorMessage>
      )}
    </FormControl>
  );
}

export default TextArea;
