using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BackfillGroupRoomsToRoomId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Eski Group.Room (string) qiymatlardan Rooms jadtaliga yangi yozuvlar yaratish
            migrationBuilder.Sql(
                @"
                INSERT INTO ""Rooms"" (""Id"", ""Name"", ""Capacity"", ""IsActive"", ""CreatedAt"")
                SELECT
                    gen_random_uuid()::text,
                    TRIM(""Room""),
                    30,  -- default capacity
                    true,
                    CURRENT_TIMESTAMP
                FROM ""Classes""
                WHERE ""Room"" IS NOT NULL
                  AND ""Room"" <> ''
                  AND TRIM(""Room"") NOT IN (SELECT ""Name"" FROM ""Rooms"")
                GROUP BY TRIM(""Room"")
                ");

            // 2. Har Group uchun RoomId'ni eski Room nomi bo'yicha to'ldirish
            migrationBuilder.Sql(
                @"
                UPDATE ""Classes""
                SET ""RoomId"" = (
                    SELECT ""Id"" FROM ""Rooms""
                    WHERE ""Rooms"".""Name"" = TRIM(""Classes"".""Room"")
                    LIMIT 1
                )
                WHERE ""Room"" IS NOT NULL
                  AND ""Room"" <> ''
                  AND ""RoomId"" IS NULL
                ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Backfill orqali yaratilgan Rooms'larni QOLDIR (data loss yo'q)
            // Lekin RoomId'ni NULL qilish mumkin (optional):
            migrationBuilder.Sql(
                @"
                UPDATE ""Classes""
                SET ""RoomId"" = NULL
                WHERE ""Room"" IS NOT NULL AND ""Room"" <> ''
                ");
        }
    }
}
