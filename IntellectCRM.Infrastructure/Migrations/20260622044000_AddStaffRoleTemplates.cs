using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IntellectCRM.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffRoleTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StaffRoleTemplates",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    DefaultPermissions = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffRoleTemplates", x => x.Id);
                });

            // Seed 3 ta template
            migrationBuilder.InsertData(
                table: "StaffRoleTemplates",
                columns: new[] { "Id", "Code", "Name", "Description", "DefaultPermissions", "CreatedAt" },
                values: new object[,]
                {
                    { "template-call-operator", "call_operator", "Qo'ng'iroq operatori", "Qo'ng'iroq qabul qiladi va lidlarni boshqaradi", "[\"leads\",\"messages\"]", DateTime.UtcNow },
                    { "template-cashier", "cashier", "Kassir", "To'lovlarni kiritadi va boshqaradi, o'quvchi ma'lumotlarini ko'radi", "[\"students\",\"finance\",\"messages\"]", DateTime.UtcNow },
                    { "template-administrator", "administrator", "Administrator", "Asosiy boshqaruv — guruhlar, o'quvchilar, o'qituvchilar, o'quv bo'limi", "[\"leads\",\"students\",\"teachers\",\"classes\",\"schedule\",\"messages\",\"app\"]", DateTime.UtcNow }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
