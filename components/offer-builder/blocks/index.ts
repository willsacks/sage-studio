"use client";

import React from "react";
import type { Block } from "@/lib/types/builder";

export { HeroBlock } from "./HeroBlock";
export { TextBlock } from "./TextBlock";
export { FeatureGridBlock } from "./FeatureGridBlock";
export { TestimonialBlock } from "./TestimonialBlock";
export { PricingCardBlock } from "./PricingCardBlock";
export { ImageTextBlock } from "./ImageTextBlock";
export { GuaranteeBlock } from "./GuaranteeBlock";
export { CTABannerBlock } from "./CTABannerBlock";
export { VideoEmbedBlock } from "./VideoEmbedBlock";
export { SpacerBlock } from "./SpacerBlock";
export { DividerBlock } from "./DividerBlock";
export { CornerNavBlock } from "./CornerNavBlock";
export { ApplicationFormBlock } from "./ApplicationFormBlock";
export { MusicEmbedBlock } from "./MusicEmbedBlock";
export { AlbumShowcaseBlock } from "./AlbumShowcaseBlock";
export { DiscographyBlock } from "./DiscographyBlock";
export { SimpleFormBlock } from "./SimpleFormBlock";

import { HeroBlock } from "./HeroBlock";
import { TextBlock } from "./TextBlock";
import { FeatureGridBlock } from "./FeatureGridBlock";
import { TestimonialBlock } from "./TestimonialBlock";
import { PricingCardBlock } from "./PricingCardBlock";
import { ImageTextBlock } from "./ImageTextBlock";
import { GuaranteeBlock } from "./GuaranteeBlock";
import { CTABannerBlock } from "./CTABannerBlock";
import { VideoEmbedBlock } from "./VideoEmbedBlock";
import { SpacerBlock } from "./SpacerBlock";
import { DividerBlock } from "./DividerBlock";
import { CornerNavBlock } from "./CornerNavBlock";
import { ApplicationFormBlock } from "./ApplicationFormBlock";
import { MusicEmbedBlock } from "./MusicEmbedBlock";
import { AlbumShowcaseBlock } from "./AlbumShowcaseBlock";
import { DiscographyBlock } from "./DiscographyBlock";
import { SimpleFormBlock } from "./SimpleFormBlock";

import type {
  HeroBlockData,
  TextBlockData,
  FeatureGridBlockData,
  TestimonialBlockData,
  PricingCardBlockData,
  ImageTextBlockData,
  GuaranteeBlockData,
  CTABannerBlockData,
  VideoEmbedBlockData,
  SpacerBlockData,
  DividerBlockData,
  CornerNavBlockData,
  ApplicationFormBlockData,
  MusicEmbedBlockData,
  AlbumShowcaseBlockData,
  DiscographyBlockData,
  SimpleFormBlockData,
} from "@/lib/types/builder";

/**
 * Renders the correct block component for a given Block record.
 * Pass `isEditing={true}` when rendering inside the builder canvas.
 */
export function renderBlock(
  block: Block,
  isEditing?: boolean,
  basePath?: string,
  siteSlug?: string
): React.ReactNode {
  switch (block.type) {
    case "hero":
      return React.createElement(HeroBlock, {
        key: block.id,
        data: block.data as HeroBlockData,
        isEditing,
      });

    case "text":
      return React.createElement(TextBlock, {
        key: block.id,
        data: block.data as TextBlockData,
        isEditing,
      });

    case "feature_grid":
      return React.createElement(FeatureGridBlock, {
        key: block.id,
        data: block.data as FeatureGridBlockData,
        isEditing,
      });

    case "testimonial":
      return React.createElement(TestimonialBlock, {
        key: block.id,
        data: block.data as TestimonialBlockData,
        isEditing,
      });

    case "pricing_card":
      return React.createElement(PricingCardBlock, {
        key: block.id,
        data: block.data as PricingCardBlockData,
        isEditing,
      });

    case "image_text":
      return React.createElement(ImageTextBlock, {
        key: block.id,
        data: block.data as ImageTextBlockData,
        isEditing,
      });

    case "guarantee":
      return React.createElement(GuaranteeBlock, {
        key: block.id,
        data: block.data as GuaranteeBlockData,
        isEditing,
      });

    case "cta_banner":
      return React.createElement(CTABannerBlock, {
        key: block.id,
        data: block.data as CTABannerBlockData,
        isEditing,
      });

    case "video_embed":
      return React.createElement(VideoEmbedBlock, {
        key: block.id,
        data: block.data as VideoEmbedBlockData,
        isEditing,
      });

    case "spacer":
      return React.createElement(SpacerBlock, {
        key: block.id,
        data: block.data as SpacerBlockData,
        isEditing,
      });

    case "divider":
      return React.createElement(DividerBlock, {
        key: block.id,
        data: block.data as DividerBlockData,
        isEditing,
      });

    case "corner_nav":
      return React.createElement(CornerNavBlock, {
        key: block.id,
        data: block.data as CornerNavBlockData,
        isEditing,
        basePath,
      });

    case "application_form":
      return React.createElement(ApplicationFormBlock, {
        key: block.id,
        data: block.data as ApplicationFormBlockData,
        isEditing,
        siteSlug,
      });

    case "music_embed":
      return React.createElement(MusicEmbedBlock, {
        key: block.id,
        data: block.data as MusicEmbedBlockData,
        isEditing,
      });

    case "album_showcase":
      return React.createElement(AlbumShowcaseBlock, {
        key: block.id,
        data: block.data as AlbumShowcaseBlockData,
        isEditing,
      });

    case "discography":
      return React.createElement(DiscographyBlock, {
        key: block.id,
        data: block.data as DiscographyBlockData,
        isEditing,
      });

    case "simple_form":
      return React.createElement(SimpleFormBlock, {
        key: block.id,
        data: block.data as SimpleFormBlockData,
        isEditing,
      });

    default:
      return null;
  }
}
