import type { ReactNode } from "react";
import { brand } from "@config/brand";

type CoinIconProps = {
  size?: number;
  className?: string;
};

export function CoinIcon({ size = 16, className = "" }: CoinIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.images.coin}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`inline-block shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

type CoinAmountProps = {
  amount: ReactNode;
  size?: number;
  className?: string;
  suffix?: string;
};

export function CoinAmount({ amount, size = 14, className = "", suffix }: CoinAmountProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <CoinIcon size={size} />
      <span>
        {amount}
        {suffix ? suffix : null}
      </span>
    </span>
  );
}
