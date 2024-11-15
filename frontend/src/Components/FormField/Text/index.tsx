/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { UseFormRegister, FieldError, UseFormSetValue } from "react-hook-form";
import { FormLabel, Input, InputLeftAddon, FormHelperText, InputGroup, FormControl, FormErrorMessage } from "@chakra-ui/react";

interface TextPropsType {
  register: UseFormRegister<any>;
  name: string;
  placeHolder?: string;
  label: string;
  defaultValue?: string;
  errorMsg?: FieldError;
  leftAddon?: string;
  helperText?: string;
  setValueFormState: UseFormSetValue<any>;
}

function Text({
  register,
  name,
  placeHolder,
  label,
  defaultValue,
  errorMsg,
  leftAddon,
  helperText,
  setValueFormState
}: TextPropsType) {

  const [value, setValue] = useState(() => {
    setValueFormState(name, defaultValue ?? '');
    return defaultValue ?? '';
  });

  async function handleChange(e: any) {
    const value: any = e.target.value;
    setValue(value);
    setValueFormState(name, value);
    console.log(name, value);
  }

  return (
    <FormControl isInvalid={errorMsg?.message !== undefined}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <InputGroup>
        {leftAddon && <InputLeftAddon>{leftAddon}</InputLeftAddon>}
        <Input
          {...register(name)}
          id={name}
          value={value}
          placeholder={placeHolder}
          onChange={handleChange}
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

export default Text;
