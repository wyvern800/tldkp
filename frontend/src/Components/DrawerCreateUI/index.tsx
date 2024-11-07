/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Button,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  Stack,
  DrawerFooter,
  Divider,
} from "@chakra-ui/react";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { azjFormat } from "../../constants/azjFormat";

import { FormField } from "../FormField";

type StatePropType = {
  isOpen: boolean;
  onClose: () => void;
};

interface DrawerExampleProps {
  title?: string;
  submitButtonLabel?: string;
  state: StatePropType;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
}

const schema = yup.object().shape({
  title: yup
    .string()
    .required("Invalid title")
    .max(35, "Your title can't have more than 35 characters!"),
  description: yup.string().required("Invalid description"),
  screenshots: yup
    .mixed()
    .test("File", "At least one screenshot file is required", (value: File | any) => value && (value instanceof Blob))
    .test(
      "Size",
      "File size must be less than 2mb",
      (value: File | any) => value && value.size <= 5000000
    ),
  interfaceFile: yup
    .mixed()
    .test("File", "HUD file is required", (value: File | any) => value && (value instanceof Blob))
    .test(
      "Size",
      "File size must be less than 2mb",
      (value: File | any) => value && value.size <= 5000000
    )
    .test("azjFormat", "Invalid HUD file (.azj)", (value: File | any) => {
      if (!value || !(value instanceof Blob)) return false;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const json = JSON.parse(event.target?.result as string);
            resolve(azjFormat.isValidSync(json));
          } catch (error) {
            resolve(false);
          }
        };
        reader.readAsText(value);
      });
    }),
});

export default function DrawerCreateUI({
  title,
  submitButtonLabel = "Submit",
  state,
  size = "xs",
}: DrawerExampleProps) {
  const { isOpen, onClose } = state ?? {};

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue
  } = useForm({ resolver: yupResolver(schema) });

  const onSubmit = (data: unknown) => console.log(data);

  return (
    <>
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size={size}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">{title}</DrawerHeader>
          <DrawerBody>
            <Stack spacing="24px">
              <FormField.Text
                register={register}
                name="title"
                label="Title"
                errorMsg={errors?.title}
                placeHolder="The HUD title"
                helperText="Enter the title you'd like to give to your HUD"
                setValueFormState={setValue}
              />
              <Divider />
              <FormField.TextArea
                register={register}
                name="description"
                label="Description"
                errorMsg={errors?.description}
                placeHolder="The HUD description"
                helperText="Enter a description for your HUD"
                setValueFormState={setValue}
              />
              <Divider />
              <FormField.FileSelector
                register={register}
                name="screenshots"
                label="Screenshots"
                errorMsg={errors?.screenshots}
                placeHolder="The HUD screenshots"
                helperText="Enter screenshots of your HUD (max 3 files)"
                setValueFormState={setValue}
                multiple={true}
                maxFiles={3}
              />
              <Divider />
              <FormField.FileSelector
                register={register}
                name="interfaceFile"
                label="HUD file"
                errorMsg={errors?.interfaceFile}
                placeHolder="The HUD file"
                helperText="Select your HUD file (.azj)"
                setValueFormState={setValue}
                accept=".azj"
                defaultValue={{}}
              />
            </Stack>
          </DrawerBody>

          <DrawerFooter borderTopWidth="1px">
            <Button variant="outline" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              colorScheme="teal"
              onClick={handleSubmit(onSubmit)}
            >
              {submitButtonLabel}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
