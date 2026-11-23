import { useCallback, useRef, useState } from 'react';
import { ApiClientError, convertFiles } from '../lib/api';
import {
  buildConversionPayload,
  type ConversionPayloadInput,
} from '../lib/conversionPayload';
import type { ConversionError, ConvertResponse } from '../types';

const UNEXPECTED_ERROR = 'Something unexpected happened. Please try again.';

interface ConversionState {
  response: ConvertResponse | null;
  errors: ConversionError[];
  requestError: string | null;
  isConverting: boolean;
}

const INITIAL_STATE: ConversionState = {
  response: null,
  errors: [],
  requestError: null,
  isConverting: false,
};

export function useConversion(input: ConversionPayloadInput) {
  const [state, setState] = useState<ConversionState>(INITIAL_STATE);
  const inFlight = useRef(false);

  const {
    files,
    globalTarget,
    globalCompression,
    pageFit,
    resizeEnabled,
    resizeWidth,
    resizeHeight,
  } = input;

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const dismissError = useCallback(() => {
    setState((current) => ({ ...current, requestError: null, errors: [] }));
  }, []);

  const convert = useCallback(async (): Promise<ConvertResponse | null> => {
    if (files.length === 0 || inFlight.current) return null;

    setState((current) => ({ ...current, requestError: null, errors: [] }));

    const prepared = buildConversionPayload({
      files,
      globalTarget,
      globalCompression,
      pageFit,
      resizeEnabled,
      resizeWidth,
      resizeHeight,
    });

    if (!prepared.ok) {
      setState((current) => ({ ...current, requestError: prepared.message }));
      return null;
    }

    inFlight.current = true;
    setState((current) => ({ ...current, isConverting: true }));

    try {
      const response = await convertFiles(
        files.map((item) => item.file),
        prepared.payload,
      );

      setState({
        response,
        errors: response.errors ?? [],
        requestError: null,
        isConverting: false,
      });
      return response;
    } catch (error) {
      const isApiError = error instanceof ApiClientError;

      setState({
        response: null,
        errors: isApiError ? (error.errors ?? []) : [],
        requestError: isApiError ? error.message : UNEXPECTED_ERROR,
        isConverting: false,
      });
      return null;
    } finally {
      inFlight.current = false;
    }
  }, [
    files,
    globalTarget,
    globalCompression,
    pageFit,
    resizeEnabled,
    resizeWidth,
    resizeHeight,
  ]);

  return {
    ...state,
    convert,
    reset,
    dismissError,
  };
}
