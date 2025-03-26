// eslint.config.mjs
import js from "@eslint/js";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import reactRefreshPlugin from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    ignores: ["node_modules", "dist", "build"], // ESLint가 무시할 폴더 지정
  },
  js.configs.recommended, // 기본 JS 추천 규칙 설정 사용
  {
    languageOptions: {
      ecmaVersion: 2020, // 최신 ECMAScript 문법 사용
      sourceType: "module", // ES 모듈 시스템 사용
      parser: typescriptParser, // TypeScript 파서 사용
      parserOptions: {
        ecmaFeatures: {
          jsx: true, // JSX 문법 지원
        },
      },
      globals: {
        React: true,
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: {
        version: "detect", // 설치된 React 버전을 자동으로 감지
        "jsx-runtime": "automatic", // React의 자동 JSX 런타임을 활성화
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin, // TypeScript ESLint 플러그인
      react: reactPlugin, // React ESLint 플러그인
      "react-hooks": reactHooksPlugin, // React Hooks ESLint 플러그인
      prettier: prettierPlugin, // Prettier ESLint 플러그인
      "react-refresh": reactRefreshPlugin, // React HMR을 위한 플러그인
    },
    rules: {
      "prettier/prettier": ["warn", { printWidth: 150 }], // Prettier 규칙 위반 시 경고
      "no-unused-vars": "off", // TypeScript에서 관리하므로 기본 규칙 끔
      "@typescript-eslint/no-unused-vars": "warn", // TypeScript: 사용되지 않는 변수 경고
      "@typescript-eslint/no-use-before-define": "warn", // TypeScript: 선언 전에 사용 금지 경고
      "react/self-closing-comp": "warn", // 자식 없는 요소는 셀프 클로징으로 작성 권장
      "react/jsx-curly-brace-presence": [
        "warn",
        { props: "never", children: "never" },
      ], // JSX 중괄호 불필요 시 제거 권장
      "react-hooks/rules-of-hooks": "error", // React Hooks 규칙 강제
      "react-hooks/exhaustive-deps": "warn", // React Hooks 의존성 검사 경고
      "react-refresh/only-export-components": "warn", // HMR을 위해 React 컴포넌트만 export하도록 권장
      "jsx-quotes": ["warn", "prefer-double"], // JSX 속성에 큰따옴표 사용 권장
      "arrow-body-style": ["warn", "as-needed"], // 불필요한 화살표 함수 본문 제거 권장
      "prefer-const": "warn", // 재할당이 없는 변수는 const 사용 권장
      "no-duplicate-imports": "warn", // 중복 import 금지 경고
      "no-console": "warn", // console.log 사용 시 경고 (디버깅용으로 사용 권장 안함)
      "react/react-in-jsx-scope": "off", // React 17 이상에서 필요 없는 규칙 비활성화
    },
  },
];
