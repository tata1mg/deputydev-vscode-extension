import { JSX } from "react";

export type AutocompleteOption = {
  icon: string;
  label: string;
  value: string;
  description: string;
};

export type FileParts = {
  start_line: number;
  end_line: number;
};

export type SearchResponseItem = {
  type: string;
  value: string;
  path: string;
  chunks: FileParts[];
};

export type ChatReferenceItem = {
  index: number;
  type: "file" | "directory" | "function" | "keyword";
  keyword: string;
  path: string;
};
