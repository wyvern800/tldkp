/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Box, IconButton, useBreakpointValue, Image } from "@chakra-ui/react";
// Here we have used react-icons package for the icons
import { BiLeftArrowAlt, BiRightArrowAlt } from "react-icons/bi";
// And react-slick as our Carousel Lib
import Slider from "react-slick";

interface CardsProps {
  title?: string;
  text?: string;
  image: string;
}

interface CarouselPropsType {
  cards: CardsProps[];
  infinite?: boolean;
  autoplay?: boolean;
  speed?: number;
  dots?: boolean;
  arrows?: boolean;
  slidesToShow?: number;
  slidesToScroll?: number;
  fade?: boolean;
  autoplaySpeed?: number;
}

export default function CaptionCarousel({
  cards,
  infinite = false,
  autoplay = true,
  speed = 300,
  dots = false,
  fade = true,
  autoplaySpeed = 5000,
  slidesToShow = 1,
  slidesToScroll = 1,
  arrows = true,
}: CarouselPropsType) {
  // As we have used custom buttons, we need a reference variable to
  // change the state
  const [slider, setSlider] = React.useState<Slider | null>(null);

  // These are the breakpoints which changes the position of the
  // buttons as the screen size changes
  const top = useBreakpointValue({ base: "90%", md: "50%" });
  const side = useBreakpointValue({ base: "30%", md: "40px" });

  // Settings for the slider
  const settings = {
    dots,
    arrows,
    fade,
    infinite,
    autoplay,
    speed,
    autoplaySpeed,
    slidesToShow,
    slidesToScroll,
  };

  return (
    <Box
      position={"relative"}
      //height={"600px"}
      width={"full"}
      overflow={"hidden"}
    >
      {/* CSS files for react-slick */}
      <link
        rel="stylesheet"
        type="text/css"
        href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.6.0/slick.min.css"
      />
      <link
        rel="stylesheet"
        type="text/css"
        href="https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.6.0/slick-theme.min.css"
      />
      {/* Left Icon */}
      <IconButton
        aria-label="left-arrow"
        variant="ghost"
        position="absolute"
        left={side}
        top={top}
        transform={"translate(0%, -50%)"}
        zIndex={2}
        onClick={() => slider?.slickPrev()}
      >
        <BiLeftArrowAlt size="40px" />
      </IconButton>
      {/* Right Icon */}
      <IconButton
        aria-label="right-arrow"
        variant="ghost"
        position="absolute"
        right={side}
        top={top}
        transform={"translate(0%, -50%)"}
        zIndex={2}
        onClick={() => slider?.slickNext()}
      >
        <BiRightArrowAlt size="40px" />
      </IconButton>
      {/* Slider */}
      <Slider {...settings} ref={(slider) => setSlider(slider)}>
        {cards.map((card: any, index: number) => (
          <Image
            key={index}
            objectFit="cover"
            src={card.image}
            alt={card.image}
            borderRadius="8px"
            mt="10px"
            mb="10px"
          />
        ))}
      </Slider>
    </Box>
  );
}
