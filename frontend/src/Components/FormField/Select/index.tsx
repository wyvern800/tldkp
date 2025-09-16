/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { UseFormRegister, UseFormSetValue } from "react-hook-form";
import {
  FormLabel,
  Select,
  InputLeftAddon,
  FormHelperText,
  InputGroup,
  FormControl,
  FormErrorMessage,
} from "@chakra-ui/react";

interface OptionType {
  value: any;
  label: string;
}

interface TextPropsType {
  register: UseFormRegister<any>;
  name: string;
  placeHolder?: string;
  label: string;
  defaultValue?: string | number | boolean;
  errorMsg?: any;
  leftAddon?: string;
  options: OptionType[];
  helperText?: string;
  setValueFormState: UseFormSetValue<any>;
}

/**
 * @example
 * To use the field, you must pass the following props:
 * ```tsx
 * <FormField.Select
 *   register={register}
 *   name="category"
 *   label="Category"
 *   errorMsg={errors?.category}
 *   options={[
 *     {
 *       value: "test1",
 *       label: "Option 1",
 *     },
 *     {
 *       value: false,
 *       label: "Option 2",
 *     },
 *   ]}
 *   setValueFormState={setValue}
 * />
 * ```
 * @param parameters { register, name, placeHolder, label, defaultValue, errorMsg, leftAddon, options, helperText, setValueFormState }
 */
function SelectField({
  register,
  name,
  placeHolder = "Select an option",
  label,
  options,
  defaultValue,
  errorMsg,
  leftAddon,
  helperText,
  setValueFormState,
}: TextPropsType) {
  const [value, setValue] = useState(() => {
    let valueToGet;

    if (typeof defaultValue === "boolean") {
      valueToGet = options?.find(
        (option) => Boolean(option.value) === Boolean(defaultValue)
      );
    } else if (typeof defaultValue === "string") {
      valueToGet = options?.find((option) => option.value === defaultValue);
    } else if (typeof defaultValue === "number") {
      valueToGet = options?.find(
        (option) => Number(option.value) === Number(defaultValue)
      );
    }

    const parsedValue = valueToGet?.value ?? "";
    setValueFormState(name, parsedValue);
    return parsedValue;
  });

  async function handleChange(e: any) {
    let newValue: any = e.target.value;

    // If instanced as a string, convert to boolean
    if (newValue === "true") {
      newValue = true;
    } else if (newValue === "false") {
      newValue = false;
    }

    setValue(newValue);
    setValueFormState(name, newValue);
    console.log(name, newValue);
  }

  return (
    <FormControl isInvalid={errorMsg?.message !== undefined}>
      <FormLabel htmlFor={name}>{label}</FormLabel>
      <InputGroup>
        {leftAddon && <InputLeftAddon>{leftAddon}</InputLeftAddon>}
        <Select
          {...register(name)}
          id={name}
          value={value}
          onChange={handleChange}
        >
          <option value="" disabled>
            {placeHolder}
          </option>

          {options?.map((option: OptionType, index: number) => (
            <option key={index} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </InputGroup>
      {!errorMsg ? (
        <FormHelperText>{helperText}</FormHelperText>
      ) : (
        <FormErrorMessage>{errorMsg?.message}</FormErrorMessage>
      )}
    </FormControl>
  );
}

export default SelectField;
