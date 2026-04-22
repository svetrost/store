"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2 } from "lucide-react";

type CameraBarcodeScannerProps = {
  active: boolean;
  onDetected: (barcode: string) => void;
  onError?: (message: string) => void;
};

type QuaggaLike = {
  init: (config: unknown, callback: (error?: Error | null) => void) => void;
  start: () => void;
  stop: () => void;
  onDetected: (callback: (result: unknown) => void) => void;
  offDetected?: (callback: (result: unknown) => void) => void;
};

function extractCode(result: unknown): string | null {
  const code = (result as { codeResult?: { code?: string } })?.codeResult?.code;

  if (typeof code !== "string") {
    return null;
  }

  const normalized = code.trim();

  return normalized ? normalized : null;
}

export function CameraBarcodeScanner({
  active,
  onDetected,
  onError,
}: CameraBarcodeScannerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const quaggaRef = useRef<QuaggaLike | null>(null);
  const detectionHandlerRef = useRef<((result: unknown) => void) | null>(null);
  const lastDetectionRef = useRef<{
    code: string;
    timestamp: number;
  } | null>(null);

  const [statusText, setStatusText] = useState("Сканер остановлен");
  const [errorText, setErrorText] = useState("");
  const [lastDetectedCode, setLastDetectedCode] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function stopScanner() {
      const quagga = quaggaRef.current;

      if (quagga) {
        try {
          if (detectionHandlerRef.current && quagga.offDetected) {
            quagga.offDetected(detectionHandlerRef.current);
          }
        } catch {
          // ignore cleanup errors
        }

        try {
          quagga.stop();
        } catch {
          // ignore cleanup errors
        }
      }

      detectionHandlerRef.current = null;
      quaggaRef.current = null;

      if (viewportRef.current) {
        viewportRef.current.innerHTML = "";
      }
    }

    async function startScanner() {
      if (!active) {
        setStatusText("Сканер остановлен");
        setErrorText("");
        await stopScanner();
        return;
      }

      if (!viewportRef.current) {
        return;
      }

      if (
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        const message =
          "Для доступа к камере нужен HTTPS или localhost. На телефоне по локальному IP камера может быть заблокирована браузером.";
        setErrorText(message);
        setStatusText("Камера недоступна");
        onError?.(message);
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        const message = "Этот браузер не поддерживает доступ к камере.";
        setErrorText(message);
        setStatusText("Камера не поддерживается");
        onError?.(message);
        return;
      }

      setErrorText("");
      setStatusText("Запуск камеры...");

      await stopScanner();

      try {
        const importedModule = await import("@ericblade/quagga2");
        const Quagga = (importedModule.default ??
          importedModule) as unknown as QuaggaLike;

        if (cancelled || !viewportRef.current) {
          return;
        }

        viewportRef.current.innerHTML = "";
        quaggaRef.current = Quagga;

        const detectionHandler = (result: unknown) => {
          const code = extractCode(result);

          if (!code) {
            return;
          }

          const now = Date.now();
          const previous = lastDetectionRef.current;

          if (
            previous &&
            previous.code === code &&
            now - previous.timestamp < 1500
          ) {
            return;
          }

          lastDetectionRef.current = {
            code,
            timestamp: now,
          };

          setLastDetectedCode(code);
          onDetected(code);
        };

        detectionHandlerRef.current = detectionHandler;

        await new Promise<void>((resolve, reject) => {
          Quagga.init(
            {
              inputStream: {
                type: "LiveStream",
                target: viewportRef.current,
                constraints: {
                  facingMode: "environment",
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              },
              locator: {
                patchSize: "medium",
                halfSample: true,
              },
              numOfWorkers: 0,
              locate: true,
              frequency: 10,
              decoder: {
                readers: [
                  "code_128_reader",
                  "ean_reader",
                  "ean_8_reader",
                  "upc_reader",
                  "upc_e_reader",
                  "code_39_reader",
                  "codabar_reader",
                ],
              },
            },
            (error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            }
          );
        });

        if (cancelled) {
          await stopScanner();
          return;
        }

        Quagga.onDetected(detectionHandler);
        Quagga.start();

        setStatusText("Камера активна. Наведи её на штрих-код.");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось запустить камеру";
        setErrorText(message);
        setStatusText("Ошибка запуска камеры");
        onError?.(message);
        await stopScanner();
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [active, onDetected, onError]);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
        <div ref={viewportRef} className="scanner-viewport" />

        {!active ? (
          <div className="scanner-overlay-grid absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
              <Camera className="h-7 w-7" />
            </div>
            <div className="mt-4 text-base font-semibold text-white">
              Камера выключена
            </div>
            <div className="mt-2 max-w-md text-sm text-slate-300">
              Нажми «Включить камеру», разреши доступ в браузере и наведи
              устройство на штрих-код.
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-6 top-6 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-white">
            Наведи камеру на штрих-код внутри кадра
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {statusText}
        </div>

        {lastDetectedCode ? (
          <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Последний код: {lastDetectedCode}
          </div>
        ) : null}
      </div>

      {errorText ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorText}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}