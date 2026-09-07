-- CreateTable
CREATE TABLE "Layout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cols" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Layout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPlacement" (
    "id" SERIAL NOT NULL,
    "layoutId" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "col" INTEGER NOT NULL,
    "row" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL,

    CONSTRAINT "RoomPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomPlacement_layoutId_scanId_key" ON "RoomPlacement"("layoutId", "scanId");

-- AddForeignKey
ALTER TABLE "RoomPlacement" ADD CONSTRAINT "RoomPlacement_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "Layout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
