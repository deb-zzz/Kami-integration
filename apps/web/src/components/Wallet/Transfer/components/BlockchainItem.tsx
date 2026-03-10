import Image from "next/image";
import { Blockchain } from "@/types";

interface BlockchainItemProps {
  blockchain: Blockchain;
}

export const BlockchainItem: React.FC<BlockchainItemProps> = ({
  blockchain,
}) => (
  <div className="flex items-center gap-2">
    {blockchain.logoUrl && (
      <Image
        src={blockchain.logoUrl}
        alt={blockchain.name}
        width={20}
        height={20}
        className="rounded-full"
      />
    )}
    <span>{blockchain.name}</span>
  </div>
);
