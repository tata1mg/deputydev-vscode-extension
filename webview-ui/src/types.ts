import { JSX } from "react";

export type AutocompleteOption = {
  icon: string;
  label: string;
  value: string;
  description: string;
  chunks: Chunk[]
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

export type Chunk = {
  start_line: number;
  end_line: number;
}

export type ChatReferenceItem = {
  index: number;
  type: "file" | "directory" | "function" | "keyword" | string;
  keyword: string;
  path: string;
  chunks: Chunk[]
};


export type ChatUserMessage  = {
  type: "TEXT_BLOCK";
  content: {
    text: string;
  };
  referenceList: ChatReferenceItem[];
  actor: "USER";
}