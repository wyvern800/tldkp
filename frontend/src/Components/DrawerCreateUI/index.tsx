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
  useToast,
} from "@chakra-ui/react";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { azjFormat } from "../../constants/azjFormat";

import { FormField } from "../FormField";

import api from "../../services/axiosInstance";

import { useUser, useAuth } from "@clerk/clerk-react";
import { useState } from "react";

type StatePropType = {
  isOpen: boolean;
  onClose: () => void;
};

interface DrawerExampleProps {
  title?: string;
  submitButtonLabel?: string;
  state: StatePropType;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
  setResponse: any;
}

const schema = yup.object().shape({
  title: yup
    .string()
    .required("Invalid title")
    .max(35, "Your title can't have more than 35 characters!"),
  description: yup.string().required("Invalid description"),
  screenshots: yup
    .mixed()
    .test(
      "File",
      "At least one screenshot file is required",
      (value: File | FileList | any) => {
        if (!value) return false;
        if (Array.isArray(value)) {
          return value.length >= 1;
        } else {
          return value;
        }
      }
    )
    .test(
      "Size",
      "File size must be less than 10mb",
      (value: File | FileList | any) => {
        if (!value) return false;

        const maxSize = 10000000;
        if (Array.isArray(value)) {
          return Array.from(value).every((file: File) => file.size < maxSize);
        }
        return value.size <= maxSize;
      }
    ),
  interfaceFile: yup
    .mixed()
    .test("File", "HUD file is required", (value: File | any) => value)
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
  setResponse,
}: DrawerExampleProps) {
  const { isSignedIn, user } = useUser();

  const { isOpen, onClose } = state ?? {};

  const { getToken, isLoaded  } = useAuth();

  const [submitting, setSubmitting] = useState(false);

  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm({ resolver: yupResolver(schema) });

  if (!isSignedIn && !isLoaded) {
    return <></>;
  }

  const resizeImage = (
    file: File,
    width: number,
    height: number
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx: any = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              const resizedFile = new File([blob], file.name, {
                type: file.type,
              });
              resolve(resizedFile);
            } else {
              reject(new Error("Canvas is empty"));
            }
          }, file.type);
        };
        img.src = event.target.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const onSubmit = async (data: any) => {
    if (!user) return;
    setSubmitting(true);

    const discordAccount: any = user.externalAccounts?.find(
      (account) => account.provider === "discord"
    );

    const formData = new FormData();

    formData.append("discordId", discordAccount?.providerUserId);

    for (const key in data) {
      if (key === "screenshots") {
        if (Array.isArray(data?.screenshots)) {
          const resizedScreenshots = await Promise.all(
            data.screenshots.map((screenshot: any) =>
              resizeImage(screenshot, 1920, 1080)
            )
          );
          resizedScreenshots.forEach((resized) => {
            formData.append(`${key}[]`, resized);
          });
        } else {
          const resized = await resizeImage(data[key], 1920, 1080);
          formData.append(`${key}[]`, resized);
        }
      } else {
        formData.append(key, data[key]);
      }
    }

    await api
      .post("/huds", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${await getToken()}`,
        },
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "An error occurred while creating your HUD",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      })
      .then((res) => {
        toast({
          title: "HUD created",
          description: "Your HUD has been successfully created!",
          status: "success",
          duration: 4000,
          isClosable: true,
        });
        setResponse(res)
        onClose();
      }).finally(() => {
        setSubmitting(false);
      });
  };

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
              isLoading={submitting}
              loadingText='Submitting'
              disabled={submitting}
            >
              {submitButtonLabel}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
